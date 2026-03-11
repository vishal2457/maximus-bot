import { ProjectManager } from "../project-manager";
import { runOpenCode, formatResultForDiscord } from "../open-code-runner";
import { MessageJob } from "../types";
import { jobRepository } from "../repositories/job-repository";

const GUILD_ID = process.env.DISCORD_GUILD_ID || "";
const DISCORD_TOKEN =
  process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || "";
const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || "";
const DISCORD_APPLICATION_ID = process.env.DISCORD_APPLICATION_ID || "";
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const DISCORD_MAX_MESSAGE_LENGTH = 2000;
const CHANNEL_CACHE_TTL_MS = parsePositiveInt(
  process.env.DISCORD_CHANNEL_CACHE_TTL_MS,
  15 * 60 * 1000,
);
const THREAD_PARENT_CACHE_TTL_MS = parsePositiveInt(
  process.env.DISCORD_THREAD_PARENT_CACHE_TTL_MS,
  24 * 60 * 60 * 1000,
);
const GATEWAY_DURATION_MS = parsePositiveInt(
  process.env.DISCORD_GATEWAY_DURATION_MS,
  10 * 60 * 1000,
);
const GATEWAY_RESTART_DELAY_MS = parsePositiveInt(
  process.env.DISCORD_GATEWAY_RESTART_DELAY_MS,
  2_000,
);

type DiscordThreadParts = {
  guildId: string;
  channelId: string;
  threadId?: string;
};

type ChatAuthor = {
  userName: string;
  fullName: string;
};

type ChatMessage = {
  text: string;
  author: ChatAuthor;
  threadId: string;
};

type ChatSentMessage = {
  edit(message: string): Promise<unknown>;
};

type ChatThread = {
  id: string;
  channelId: string;
  post(message: string): Promise<ChatSentMessage>;
};

type DiscordAdapterLike = {
  decodeThreadId(threadId: string): DiscordThreadParts;
  startGatewayListener(
    options: { waitUntil: (task: Promise<unknown>) => void },
    durationMs?: number,
    abortSignal?: AbortSignal,
    webhookUrl?: string,
  ): Promise<Response>;
};

type DiscordAdaptersLike = {
  get(name: string): DiscordAdapterLike | undefined;
};

type ChatBotLike = {
  adapters: DiscordAdaptersLike;
  webhooks: {
    discord(
      request: Request,
      options?: { waitUntil?: (task: Promise<unknown>) => void },
    ): Promise<Response>;
  };
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  onNewMessage(
    pattern: RegExp,
    handler: (thread: ChatThread, message: ChatMessage) => Promise<void>,
  ): void;
};

type ThreadHandle = {
  id: string;
  channelId: string;
  post(message: string): Promise<ChatSentMessage>;
};

type DiscordChannelSummary = {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
};

type CachedChannelMeta = {
  id: string;
  name?: string;
  type?: number;
  parentId: string | null;
  fetchedAt: number;
};

type CachedThreadParent = {
  parentChannelId: string;
  fetchedAt: number;
};

type ChatCtor = new (config: {
  userName: string;
  adapters: { discord: unknown };
  state: unknown;
}) => ChatBotLike;

type ChatSdkModule = {
  Chat: ChatCtor;
};

type DiscordAdapterModule = {
  createDiscordAdapter(config?: {
    botToken?: string;
    publicKey?: string;
    applicationId?: string;
    userName?: string;
  }): unknown;
};

type MemoryStateModule = {
  createMemoryState(): unknown;
};

export class DiscordBot {
  private projectManager: ProjectManager;
  private bot: ChatBotLike | null = null;
  private isInitialized = false;
  private isStopping = false;
  private gatewayLoopPromise: Promise<void> | null = null;
  private gatewayAbortController: AbortController | null = null;
  private channelMetaCache = new Map<string, CachedChannelMeta>();
  private threadParentCache = new Map<string, CachedThreadParent>();
  private channelMetaInFlight = new Map<string, Promise<CachedChannelMeta | null>>();

  constructor(projectManager: ProjectManager) {
    this.projectManager = projectManager;
  }

  isReady(): boolean {
    return this.isInitialized && !this.isStopping;
  }

  async start(): Promise<void> {
    if (!DISCORD_TOKEN) {
      throw new Error(
        "DISCORD_BOT_TOKEN or DISCORD_TOKEN is not set in environment",
      );
    }

    if (!GUILD_ID) {
      throw new Error("DISCORD_GUILD_ID is not set in environment");
    }

    const bot = await this.ensureBot();
    await bot.initialize();

    this.isInitialized = true;
    this.isStopping = false;

    console.log("[Discord] Chat SDK initialized.");

    await this.syncChannels();
    this.startGatewayLoop();
  }

  async shutdown(): Promise<void> {
    this.isStopping = true;
    this.isInitialized = false;

    if (this.gatewayAbortController) {
      this.gatewayAbortController.abort();
      this.gatewayAbortController = null;
    }

    if (this.gatewayLoopPromise) {
      await this.gatewayLoopPromise;
      this.gatewayLoopPromise = null;
    }

    if (this.bot) {
      await this.bot.shutdown();
    }
  }

  async handleWebhook(request: Request): Promise<Response> {
    const bot = await this.ensureBot();

    return bot.webhooks.discord(request, {
      waitUntil: (task) => {
        task.catch((error: unknown) => {
          console.error("[Discord] Webhook background task failed:", error);
        });
      },
    });
  }

  async postToChannel(channelId: string, content: string): Promise<void> {
    await this.discordApi(`/channels/${channelId}/messages`, "POST", {
      content: truncateDiscordMessage(content),
    });
  }

  async syncChannels(): Promise<void> {
    console.log("[Discord] Syncing channels with projects.json...");

    const projects = this.projectManager.getAll();
    const needsFullGuildLookup = projects.some(
      (project) =>
        !project.discordCategoryId || !project.developmentChannelId,
    );
    const channels: DiscordChannelSummary[] = needsFullGuildLookup
      ? ((await this.discordApi(
          `/guilds/${GUILD_ID}/channels`,
          "GET",
        )) as DiscordChannelSummary[])
      : [];

    for (const channel of channels) {
      this.rememberChannelSummary(channel);
    }

    for (const project of projects) {
      const hasKnownChannelIds =
        !!project.discordCategoryId && !!project.developmentChannelId;
      if (hasKnownChannelIds) {
        this.rememberChannelSummary({
          id: project.discordCategoryId,
          name: project.name,
          type: 4,
          parent_id: null,
        });
        this.rememberChannelSummary({
          id: project.developmentChannelId,
          name: "development",
          type: 0,
          parent_id: project.discordCategoryId,
        });
        continue;
      }

      let category = channels.find(
        (c) => c.type === 4 && c.name === project.name && c.parent_id === null,
      );

      if (!category) {
        category = (await this.discordApi(
          `/guilds/${GUILD_ID}/channels`,
          "POST",
          {
            name: project.name,
            type: 4,
          },
        )) as { id: string; name: string; type: number };

        console.log(`[Discord] Created category: ${project.name}`);
        channels.push(category);
        this.rememberChannelSummary(category);
      }

      const categoryChannels = channels.filter(
        (c) => c.parent_id === category!.id,
      );

      let developmentChannel = categoryChannels.find(
        (c) => c.type === 0 && c.name === "development",
      );

      if (!developmentChannel) {
        developmentChannel = (await this.discordApi(
          `/guilds/${GUILD_ID}/channels`,
          "POST",
          {
            name: "development",
            type: 0,
            parent_id: category.id,
            topic: `OpenCode coding sessions for: ${project.description}`,
          },
        )) as {
          id: string;
          name: string;
          type: number;
          parent_id?: string | null;
        };

        console.log(
          `[Discord] Created #development channel in ${project.name}`,
        );
        channels.push(developmentChannel);
        this.rememberChannelSummary(developmentChannel);

        await this.postToChannel(
          developmentChannel.id,
          `**${project.name}** development channel ready.\n` +
            `Folder: \`${project.folder}\`\n` +
            `${project.description}\n\n` +
            `Send any message here to start an OpenCode coding session. ` +
            `Use threads to continue sessions. Prefix with \`#\` to leave a note.`,
        );
      }

      if (
        project.discordCategoryId !== category.id ||
        project.developmentChannelId !== developmentChannel.id
      ) {
        this.projectManager.updateDiscordChannelIds(
          project.id,
          category.id,
          developmentChannel.id,
          project.linearIssuesChannelId || "",
        );
      }
    }

    console.log(
      `[Discord] Sync complete. ${projects.length} project category(ies) ready.`,
    );
  }

  private async ensureBot(): Promise<ChatBotLike> {
    if (this.bot) {
      return this.bot;
    }

    const [{ Chat }, { createDiscordAdapter }, { createMemoryState }] =
      await Promise.all([
        loadModule<ChatSdkModule>("chat"),
        loadModule<DiscordAdapterModule>("@chat-adapter/discord"),
        loadModule<MemoryStateModule>("@chat-adapter/state-memory"),
      ]);

    const bot = new Chat({
      userName: "opencode",
      adapters: {
        discord: createDiscordAdapter({
          botToken: DISCORD_TOKEN,
          publicKey: DISCORD_PUBLIC_KEY || undefined,
          applicationId: DISCORD_APPLICATION_ID || undefined,
          userName: "opencode",
        }),
      },
      state: createMemoryState(),
    });

    bot.onNewMessage(/^[\s\S]+$/, async (thread, message) => {
      await this.handleIncomingMessage(thread, message);
    });

    this.bot = bot;
    return bot;
  }

  private async handleIncomingMessage(
    thread: ChatThread,
    message: ChatMessage,
  ): Promise<void> {
    console.log(
      `[Discord] Processing message from ${message.author.fullName || message.author.userName}: ${message.text.slice(0, 100)}...`,
    );

    const rawChannelId = await this.resolveChannelId(
      thread.channelId,
      message.threadId,
    );
    if (!rawChannelId) {
      console.log("[Discord] Could not resolve channel ID, skipping");
      return;
    }

    const project = this.projectManager.getByDiscordChannelId(rawChannelId);
    if (!project) {
      console.log(`[Discord] No project found for channel ${rawChannelId}`);
      await thread.post(
        "This channel is not authorized to access any workspace. Please contact the bot administrator to configure project access for this channel.",
      );
      return;
    }

    const prompt = message.text.trim();
    if (!prompt || prompt.startsWith("#")) {
      return;
    }

    console.log(
      `[Discord] Routing to project "${project.name}" at ${project.folder}`,
    );

    const isLinearChannel = rawChannelId === project.linearIssuesChannelId;
    const resolvedThreadId = await this.resolveThreadId(
      thread.channelId,
      message.threadId,
    );
    const isNewThread = resolvedThreadId === rawChannelId;

    if (isNewThread) {
      let targetThread: ThreadHandle = thread;

      // A top-level channel message should spawn a dedicated Discord thread.
      if (resolvedThreadId === rawChannelId) {
        try {
          targetThread = await this.createSessionThread(rawChannelId, prompt);
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error);
          await thread.post(
            `Could not auto-create a thread for this session (${errMsg}). Please create a thread manually and retry.`,
          );
          return;
        }
      }

      await this.handleNewSession(targetThread, {
        projectId: project.id,
        channelId: rawChannelId,
        threadId: targetThread.id,
        prompt,
        authorTag: message.author.fullName || message.author.userName,
        isLinearChannel,
      });
    } else {
      await this.handleExistingSession(thread, {
        projectId: project.id,
        channelId: rawChannelId,
        threadId: resolvedThreadId,
        prompt,
        authorTag: message.author.fullName || message.author.userName,
        isLinearChannel,
      });
    }
  }

  private async handleNewSession(
    thread: ThreadHandle,
    job: MessageJob,
  ): Promise<void> {
    const {
      projectId,
      channelId,
      threadId,
      prompt,
      authorTag,
      isLinearChannel,
    } = job;

    const project = this.projectManager.getById(projectId);
    if (!project) {
      console.log(`[Discord] Project not found: ${projectId}`);
      return;
    }

    console.log(
      `[Discord] Starting new session for ${authorTag} in project "${project.name}"`,
    );

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    jobRepository.create({
      id: jobId,
      projectId,
      channelId,
      threadId,
      sessionId: null,
      prompt,
      authorTag,
      status: "running",
      createdAt: new Date(),
      startedAt: new Date(),
    });

    const thinkingMsg = await thread.post(
      isLinearChannel
        ? `Starting new OpenCode session for Linear issues in \`${project.name}\`...\n> ${prompt.slice(0, 200)}`
        : `Starting new OpenCode session in \`${project.folder}\`...\n> ${prompt.slice(0, 200)}`,
    );

    const typing = await this.startTypingInterval(thread.id);

    try {
      console.log(`[Discord] Calling runOpenCode for job ${jobId}...`);
      const result = await runOpenCode(prompt, project.folder);
      console.log(
        `[Discord] runOpenCode completed for job ${jobId}: success=${result.success}, duration=${result.duration}ms`,
      );

      jobRepository.updateStatus(
        jobId,
        result.success ? "completed" : "failed",
        {
          sessionId: result.sessionId || null,
          result: result.output,
          error: result.error || null,
          duration: result.duration,
          completedAt: new Date(),
        },
      );

      const reply = formatResultForDiscord(result, project.name);
      await thinkingMsg.edit(reply);
      typing.stop();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Discord] Error in job ${jobId}:`, errMsg);

      jobRepository.updateStatus(jobId, "failed", {
        error: errMsg,
        completedAt: new Date(),
      });

      try {
        await thinkingMsg.edit(`Internal error: ${errMsg}`);
        typing.stop();
      } catch (editErr: unknown) {
        console.error("[Discord] Failed to edit thinking message:", editErr);
      }
    }
  }

  private async handleExistingSession(
    thread: ThreadHandle,
    job: MessageJob,
  ): Promise<void> {
    const {
      projectId,
      channelId,
      threadId,
      prompt,
      authorTag,
      isLinearChannel,
    } = job;

    const activeJob = jobRepository.getActiveByThreadId(threadId);
    if (activeJob) {
      await thread.post(
        "A job is already running in this thread. Please wait.",
      );
      return;
    }

    const project = this.projectManager.getById(projectId);
    if (!project) {
      return;
    }

    const previousSessionJob =
      jobRepository.getLatestWithSessionByThreadId(threadId) ||
      jobRepository.getByThreadId(threadId);
    const sessionId = previousSessionJob?.sessionId || undefined;

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    jobRepository.create({
      id: jobId,
      projectId,
      channelId,
      threadId,
      sessionId: sessionId || null,
      prompt,
      authorTag,
      status: "running",
      createdAt: new Date(),
      startedAt: new Date(),
    });

    console.log(
      `[Discord] Job ${jobId} from ${authorTag} in thread ${threadId}: ${prompt.slice(0, 80)}${sessionId ? " (resuming session)" : ""}`,
    );

    const thinkingMsg = await thread.post(
      isLinearChannel
        ? `Continuing OpenCode session for Linear issues...\n> ${prompt.slice(0, 200)}`
        : `Continuing OpenCode session...\n> ${prompt.slice(0, 200)}`,
    );

    const typing = await this.startTypingInterval(thread.id);

    try {
      console.log(`[Discord] Calling runOpenCode for job ${jobId}...`);
      const result = await runOpenCode(prompt, project.folder, sessionId);
      console.log(
        `[Discord] runOpenCode completed for job ${jobId}: success=${result.success}, duration=${result.duration}ms`,
      );

      jobRepository.updateStatus(
        jobId,
        result.success ? "completed" : "failed",
        {
          sessionId: result.sessionId || sessionId || null,
          result: result.output,
          error: result.error || null,
          duration: result.duration,
          completedAt: new Date(),
        },
      );

      const reply = formatResultForDiscord(result, project.name);
      await thinkingMsg.edit(reply);
      typing.stop();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Discord] Error in job ${jobId}:`, errMsg);

      jobRepository.updateStatus(jobId, "failed", {
        error: errMsg,
        completedAt: new Date(),
      });

      try {
        await thinkingMsg.edit(`Internal error: ${errMsg}`);
        typing.stop();
      } catch (editErr: unknown) {
        console.error("[Discord] Failed to edit thinking message:", editErr);
      }
    }
  }

  private async resolveChannelId(
    channelId: string,
    threadId: string,
  ): Promise<string | null> {
    if (!this.bot) {
      return null;
    }

    const adapter = this.bot.adapters.get("discord");
    if (!adapter) {
      return null;
    }

    if (channelId !== threadId) {
      try {
        const decoded = adapter.decodeThreadId(threadId);
        if (decoded.channelId) {
          return decoded.channelId;
        }
      } catch {
        // no-op
      }
    }

    if (threadId) {
      const cachedParent = this.getThreadParentFromCache(threadId);
      if (cachedParent) {
        return cachedParent;
      }

      try {
        const thread = await this.getChannelMetaCached(threadId);
        if (thread?.parentId) {
          this.rememberThreadParent(threadId, thread.parentId);
          return thread.parentId;
        }
      } catch {
        // no-op
      }
    }

    if (channelId) {
      try {
        const channel = await this.getChannelMetaCached(channelId);
        if (channel?.parentId) {
          return channel.parentId;
        }
        return channelId;
      } catch {
        // no-op
      }
    }

    return null;
  }

  private async resolveThreadId(
    channelId: string,
    threadId: string,
  ): Promise<string> {
    if (threadId) {
      const decoded = this.tryDecodeThreadId(threadId);
      if (decoded) {
        if (decoded.threadId) {
          return decoded.threadId;
        }
        if (decoded.channelId) {
          return decoded.channelId;
        }
      }
    }

    if (channelId) {
      const decoded = this.tryDecodeThreadId(channelId);
      if (decoded) {
        if (decoded.threadId) {
          return decoded.threadId;
        }
        if (decoded.channelId) {
          return decoded.channelId;
        }
      }
    }

    for (const candidate of [threadId, channelId]) {
      if (!candidate || !isDiscordSnowflake(candidate)) {
        continue;
      }

      try {
        const channel = await this.getChannelMetaCached(candidate);
        if (channel?.id && channel.parentId) {
          this.rememberThreadParent(channel.id, channel.parentId);
          return channel.id;
        }
      } catch {
        // no-op
      }
    }

    return threadId || channelId;
  }

  private tryDecodeThreadId(threadId: string): DiscordThreadParts | null {
    if (!this.bot) {
      return null;
    }

    const adapter = this.bot.adapters.get("discord");
    if (!adapter) {
      return null;
    }

    try {
      return adapter.decodeThreadId(threadId);
    } catch {
      return null;
    }
  }

  private rememberChannelSummary(channel: DiscordChannelSummary): void {
    this.channelMetaCache.set(channel.id, {
      id: channel.id,
      name: channel.name,
      type: channel.type,
      parentId: channel.parent_id ?? null,
      fetchedAt: Date.now(),
    });
  }

  private rememberThreadParent(
    threadId: string,
    parentChannelId: string,
  ): void {
    this.threadParentCache.set(threadId, {
      parentChannelId,
      fetchedAt: Date.now(),
    });
  }

  private getThreadParentFromCache(threadId: string): string | null {
    const cached = this.threadParentCache.get(threadId);
    if (!cached) {
      return null;
    }

    if (Date.now() - cached.fetchedAt > THREAD_PARENT_CACHE_TTL_MS) {
      this.threadParentCache.delete(threadId);
      return null;
    }

    return cached.parentChannelId;
  }

  private async getChannelMetaCached(
    channelId: string,
  ): Promise<CachedChannelMeta | null> {
    const cached = this.channelMetaCache.get(channelId);
    if (cached && Date.now() - cached.fetchedAt <= CHANNEL_CACHE_TTL_MS) {
      return cached;
    }

    const inFlight = this.channelMetaInFlight.get(channelId);
    if (inFlight) {
      return inFlight;
    }

    const fetchPromise = (async () => {
      try {
        const channel = (await this.discordApi(
          `/channels/${channelId}`,
          "GET",
        )) as {
          id: string;
          name?: string;
          type?: number;
          parent_id?: string | null;
        } | null;

        if (!channel?.id) {
          return null;
        }

        const nextCached: CachedChannelMeta = {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          parentId: channel.parent_id ?? null,
          fetchedAt: Date.now(),
        };
        this.channelMetaCache.set(channel.id, nextCached);
        if (nextCached.parentId) {
          this.rememberThreadParent(channel.id, nextCached.parentId);
        }
        return nextCached;
      } finally {
        this.channelMetaInFlight.delete(channelId);
      }
    })();

    this.channelMetaInFlight.set(channelId, fetchPromise);
    return fetchPromise;
  }

  private startGatewayLoop(): void {
    if (this.gatewayLoopPromise) {
      return;
    }

    this.gatewayLoopPromise = this.runGatewayLoop().finally(() => {
      this.gatewayLoopPromise = null;
    });
  }

  private async runGatewayLoop(): Promise<void> {
    const bot = await this.ensureBot();
    const adapter = bot.adapters.get("discord");
    if (!adapter) {
      throw new Error("Discord adapter not found");
    }

    while (!this.isStopping) {
      this.gatewayAbortController = new AbortController();
      let listenerTask: Promise<unknown> | null = null;

      try {
        const response = await adapter.startGatewayListener(
          {
            waitUntil: (task) => {
              listenerTask = task;
            },
          },
          GATEWAY_DURATION_MS,
          this.gatewayAbortController.signal,
          DISCORD_WEBHOOK_URL || undefined,
        );

        if (!response.ok) {
          const text = await response.text();
          console.error(
            `[Discord] Gateway listener failed to start: ${response.status} ${text}`,
          );
          await delay(GATEWAY_RESTART_DELAY_MS);
          continue;
        }

        console.log("[Discord] Gateway listener running.");

        if (listenerTask) {
          await listenerTask;
        } else {
          await delay(GATEWAY_DURATION_MS);
        }
      } catch (error: unknown) {
        if (!this.isStopping) {
          console.error("[Discord] Gateway listener error:", error);
        }
      } finally {
        this.gatewayAbortController = null;
      }

      if (!this.isStopping) {
        await delay(GATEWAY_RESTART_DELAY_MS);
      }
    }
  }

  private async sendTyping(channelId: string): Promise<void> {
    await this.discordApi(`/channels/${channelId}/typing`, "POST");
  }

  private async startTypingInterval(
    channelId: string,
    intervalMs = 5000,
  ): Promise<{ stop: () => void }> {
    await this.sendTyping(channelId);
    const intervalId = setInterval(async () => {
      try {
        await this.sendTyping(channelId);
      } catch {
        clearInterval(intervalId);
      }
    }, intervalMs);

    return {
      stop: () => clearInterval(intervalId),
    };
  }

  private async discordApi(
    path: string,
    method: "GET" | "POST" | "PATCH",
    body?: unknown,
  ): Promise<unknown> {
    const response = await fetch(`${DISCORD_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bot ${DISCORD_TOKEN}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Discord API ${method} ${path} failed (${response.status}): ${text}`,
      );
    }

    if (response.status === 204) {
      return {};
    }

    return response.json();
  }

  private async createSessionThread(
    channelId: string,
    prompt: string,
  ): Promise<ThreadHandle> {
    const nameSource = prompt.trim() || "session";
    const sanitized = nameSource
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "")
      .slice(0, 60)
      .toLowerCase();
    const threadName = sanitized || `session-${Date.now()}`;

    const created = (await this.discordApi(
      `/channels/${channelId}/threads`,
      "POST",
      {
        name: threadName,
        type: 11,
        auto_archive_duration: 1440,
      },
    )) as { id: string };
    this.rememberThreadParent(created.id, channelId);
    this.channelMetaCache.set(created.id, {
      id: created.id,
      parentId: channelId,
      fetchedAt: Date.now(),
    });

    return {
      id: created.id,
      channelId,
      post: async (message: string): Promise<ChatSentMessage> => {
        const posted = (await this.discordApi(
          `/channels/${created.id}/messages`,
          "POST",
          { content: truncateDiscordMessage(message) },
        )) as { id: string };

        return {
          edit: async (nextMessage: string): Promise<unknown> => {
            return this.discordApi(
              `/channels/${created.id}/messages/${posted.id}`,
              "PATCH",
              { content: truncateDiscordMessage(nextMessage) },
            );
          },
        };
      },
    };
  }
}

async function loadModule<TModule>(specifier: string): Promise<TModule> {
  const dynamicImport = new Function(
    "moduleSpecifier",
    "return import(moduleSpecifier)",
  ) as (moduleSpecifier: string) => Promise<TModule>;

  return dynamicImport(specifier);
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncateDiscordMessage(content: string): string {
  if (content.length <= DISCORD_MAX_MESSAGE_LENGTH) {
    return content;
  }

  return `${content.slice(0, DISCORD_MAX_MESSAGE_LENGTH - 3)}...`;
}

function isDiscordSnowflake(value: string): boolean {
  return /^\d{15,22}$/.test(value);
}
