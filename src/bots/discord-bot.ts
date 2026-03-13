import { ProjectManager } from "../project-manager";
import { logger } from "../shared/logger";
import {
  DISCORD_API_BASE_URL,
  DISCORD_CHANNEL_TYPE_CATEGORY,
  DISCORD_CHANNEL_TYPE_TEXT,
} from "../shared/constants";
import {
  getDevelopmentChannelName,
  isLegacyDevelopmentChannelName,
} from "../shared/discord-channel.util";
import { jobQueueRepository } from "../repositories/job-queue-repository";
import type {
  PermissionHandler,
  PermissionReply,
  PermissionRequest,
  QuestionRequest,
} from "../permission-handler";

const GUILD_ID = process.env.DISCORD_GUILD_ID || "";
const DISCORD_TOKEN =
  process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || "";
const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || "";
const DISCORD_APPLICATION_ID = process.env.DISCORD_APPLICATION_ID || "";
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";

const DISCORD_API_BASE = DISCORD_API_BASE_URL;
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
const PERMISSION_TIMEOUT_MS = parsePositiveInt(
  process.env.PERMISSION_TIMEOUT_MS,
  15 * 60 * 1000,
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
  isMention?: boolean;
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
  onNewMention(
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

type PendingPermission = {
  jobId: string;
  resolve(reply: PermissionReply): void;
  reject(error: Error): void;
  expiresAt: number;
};

type PendingQuestion = {
  jobId: string;
  request: QuestionRequest;
  resolve(answers: string[][]): void;
  reject(error: Error): void;
  expiresAt: number;
};

export class DiscordBot implements PermissionHandler {
  private projectManager: ProjectManager;
  private bot: ChatBotLike | null = null;
  private isInitialized = false;
  private isStopping = false;
  private gatewayLoopPromise: Promise<void> | null = null;
  private gatewayAbortController: AbortController | null = null;
  private channelMetaCache = new Map<string, CachedChannelMeta>();
  private threadParentCache = new Map<string, CachedThreadParent>();
  private channelMetaInFlight = new Map<
    string,
    Promise<CachedChannelMeta | null>
  >();
  private pendingPermissions = new Map<string, PendingPermission>();
  private pendingQuestions = new Map<string, PendingQuestion>();

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

    logger.info("Discord chat SDK initialized");

    await this.syncChannels();
    this.startGatewayLoop();
  }

  async shutdown(): Promise<void> {
    this.isStopping = true;
    this.isInitialized = false;

    for (const [threadId, pending] of this.pendingPermissions.entries()) {
      pending.reject(new Error("Discord bot is shutting down."));
    }
    this.pendingPermissions.clear();

    for (const [threadId, pending] of this.pendingQuestions.entries()) {
      pending.reject(new Error("Discord bot is shutting down."));
    }
    this.pendingQuestions.clear();

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
          logger.error("Discord webhook background task failed", { error });
        });
      },
    });
  }

  async postToChannel(channelId: string, content: string): Promise<void> {
    await this.discordApi(`/channels/${channelId}/messages`, "POST", {
      content: truncateDiscordMessage(content),
    });
  }

  async onPermissionRequest(
    request: PermissionRequest,
  ): Promise<PermissionReply> {
    return new Promise((resolve, reject) => {
      const pending: PendingPermission = {
        jobId: request.jobId,
        resolve,
        reject,
        expiresAt: Date.now() + PERMISSION_TIMEOUT_MS,
      };

      this.pendingPermissions.set(request.jobId, pending);

      this.postToThread(
        request.threadId,
        formatPermissionRequest(request),
      ).catch((error) => {
        logger.error("Failed to post permission request", {
          jobId: request.jobId,
          error,
        });
        this.pendingPermissions.delete(request.jobId);
        reject(error);
      });

      setTimeout(() => {
        const existing = this.pendingPermissions.get(request.jobId);
        if (existing === pending) {
          this.pendingPermissions.delete(request.jobId);
          reject(new Error("Permission request timed out"));
        }
      }, PERMISSION_TIMEOUT_MS);
    });
  }

  async onQuestionRequest(request: QuestionRequest): Promise<string[][]> {
    return new Promise((resolve, reject) => {
      const pending: PendingQuestion = {
        jobId: request.jobId,
        request,
        resolve,
        reject,
        expiresAt: Date.now() + PERMISSION_TIMEOUT_MS,
      };

      this.pendingQuestions.set(request.jobId, pending);

      this.postToThread(request.threadId, formatQuestionRequest(request)).catch(
        (error) => {
          logger.error("Failed to post question request", {
            jobId: request.jobId,
            error,
          });
          this.pendingQuestions.delete(request.jobId);
          reject(error);
        },
      );

      setTimeout(() => {
        const existing = this.pendingQuestions.get(request.jobId);
        if (existing === pending) {
          this.pendingQuestions.delete(request.jobId);
          reject(new Error("Question request timed out"));
        }
      }, PERMISSION_TIMEOUT_MS);
    });
  }

  async syncChannels(): Promise<void> {
    logger.info("Syncing Discord channels with projects");

    const projects = this.projectManager.getAll();
    const needsFullGuildLookup = projects.some(
      (project) => !project.discordCategoryId || !project.developmentChannelId,
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
      const expectedDevelopmentChannelName = getDevelopmentChannelName(
        project.name,
      );
      const categoryId = project.discordCategoryId;
      const developmentChannelId = project.developmentChannelId;
      if (categoryId && developmentChannelId) {
        this.rememberChannelSummary({
          id: categoryId,
          name: project.name,
          type: DISCORD_CHANNEL_TYPE_CATEGORY,
          parent_id: null,
        });
        this.rememberChannelSummary({
          id: developmentChannelId,
          name: expectedDevelopmentChannelName,
          type: DISCORD_CHANNEL_TYPE_TEXT,
          parent_id: categoryId,
        });

        const currentDevelopmentChannel =
          await this.getChannelMetaCached(developmentChannelId);
        if (
          currentDevelopmentChannel?.name &&
          currentDevelopmentChannel.name !== expectedDevelopmentChannelName
        ) {
          await this.discordApi(`/channels/${developmentChannelId}`, "PATCH", {
            name: expectedDevelopmentChannelName,
          });
          this.channelMetaCache.set(developmentChannelId, {
            ...currentDevelopmentChannel,
            name: expectedDevelopmentChannelName,
            fetchedAt: Date.now(),
          });
          logger.info("Renamed Discord development channel", {
            projectId: project.id,
            projectName: project.name,
            channelId: developmentChannelId,
            from: currentDevelopmentChannel.name,
            to: expectedDevelopmentChannelName,
          });
        }
        continue;
      }

      let category = channels.find((c) => {
        return (
          c.type === DISCORD_CHANNEL_TYPE_CATEGORY &&
          c.name === project.name &&
          c.parent_id === null
        );
      });

      if (!category) {
        category = (await this.discordApi(
          `/guilds/${GUILD_ID}/channels`,
          "POST",
          {
            name: project.name,
            type: DISCORD_CHANNEL_TYPE_CATEGORY,
          },
        )) as { id: string; name: string; type: number };

        logger.info("Created Discord category", {
          projectId: project.id,
          projectName: project.name,
        });
        channels.push(category);
        this.rememberChannelSummary(category);
      }

      const categoryChannels = channels.filter(
        (c) => c.parent_id === category!.id,
      );

      let developmentChannel = categoryChannels.find((c) => {
        return (
          c.type === DISCORD_CHANNEL_TYPE_TEXT &&
          (c.name === expectedDevelopmentChannelName ||
            isLegacyDevelopmentChannelName(c.name))
        );
      });

      if (!developmentChannel) {
        developmentChannel = (await this.discordApi(
          `/guilds/${GUILD_ID}/channels`,
          "POST",
          {
            name: expectedDevelopmentChannelName,
            type: DISCORD_CHANNEL_TYPE_TEXT,
            parent_id: category.id,
            topic: `OpenCode coding sessions for: ${project.description}`,
          },
        )) as {
          id: string;
          name: string;
          type: number;
          parent_id?: string | null;
        };

        logger.info("Created Discord development channel", {
          projectId: project.id,
          projectName: project.name,
          channelId: developmentChannel.id,
        });
        channels.push(developmentChannel);
        this.rememberChannelSummary(developmentChannel);

        await this.postToChannel(
          developmentChannel.id,
          `**${project.name}** development channel ready.\n` +
            `Folder: \`${project.folder}\`\n` +
            `${project.description}\n\n` +
            `Mention the bot to start an OpenCode coding session. ` +
            `Use threads to continue sessions, and mention the bot there too. ` +
            `Prefix with \`#\` to leave a note.`,
        );
      } else if (developmentChannel.name !== expectedDevelopmentChannelName) {
        await this.discordApi(`/channels/${developmentChannel.id}`, "PATCH", {
          name: expectedDevelopmentChannelName,
        });
        developmentChannel = {
          ...developmentChannel,
          name: expectedDevelopmentChannelName,
        };
        this.rememberChannelSummary(developmentChannel);
        logger.info("Renamed Discord development channel", {
          projectId: project.id,
          projectName: project.name,
          channelId: developmentChannel.id,
          to: expectedDevelopmentChannelName,
        });
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

    logger.info("Discord sync complete", {
      projectCount: projects.length,
    });
  }

  private async ensureBot(): Promise<ChatBotLike> {
    if (this.bot) {
      return this.bot;
    }

    const [{ Chat }, { createDiscordAdapter }, { createMemoryState }] =
      await Promise.all([
        loadModule<{ Chat: ChatCtor }>("chat"),
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

    bot.onNewMention(async (thread, message) => {
      await this.handleIncomingMessage(thread, message);
    });

    this.bot = bot;
    return bot;
  }

  private async handleIncomingMessage(
    thread: ChatThread,
    message: ChatMessage,
  ): Promise<void> {
    logger.info("Processing Discord message", {
      author: message.author.fullName || message.author.userName,
      threadId: message.threadId,
      preview: message.text.slice(0, 100),
    });

    const permissionReply = this.tryHandlePermissionReply(message);
    if (permissionReply.handled) {
      return;
    }

    const questionReply = this.tryHandleQuestionReply(message);
    if (questionReply.handled) {
      return;
    }

    const rawChannelId = await this.resolveChannelId(
      thread.channelId,
      message.threadId,
    );
    if (!rawChannelId) {
      logger.warn("Could not resolve Discord channel ID, skipping message");
      return;
    }

    const project = this.projectManager.getByDiscordChannelId(rawChannelId);
    if (!project) {
      logger.warn("No project found for Discord channel", {
        channelId: rawChannelId,
      });
      await thread.post(
        "This channel is not authorized to access any workspace. Please contact the bot administrator to configure project access for this channel.",
      );
      return;
    }

    const prompt = this.extractMentionPrompt(message.text);
    if (!prompt) {
      return;
    }

    if (prompt.startsWith("#")) {
      return;
    }

    logger.info("Routing message to project workspace", {
      projectId: project.id,
      projectName: project.name,
      folder: project.folder,
    });

    const resolvedThreadId = await this.resolveThreadId(
      thread.channelId,
      message.threadId,
    );

    const isNewThread = resolvedThreadId === rawChannelId;

    console.log("[THREAD_DEBUG] isNewThread check", {
      resolvedThreadId,
      rawChannelId,
      isNewThread,
      messageThreadId: message.threadId,
      threadChannelId: thread.channelId,
      threadId: thread.id,
    });

    let targetThread: ThreadHandle = thread;
    let finalThreadId = resolvedThreadId;

    if (isNewThread) {
      try {
        targetThread = await this.createSessionThread(rawChannelId, prompt);
        finalThreadId = targetThread.id;
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await thread.post(
          `Could not auto-create a thread for this session (${errMsg}). Please create a thread manually and retry.`,
        );
        return;
      }
    } else {
      await this.renameThreadIfNeeded(finalThreadId, prompt);
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const isLinearChannel = rawChannelId === project.linearIssuesChannelId;

    jobQueueRepository.createJob({
      id: jobId,
      projectId: project.id,
      channelId: rawChannelId,
      threadId: finalThreadId,
      sessionId: null,
      prompt,
      authorTag: message.author.fullName || message.author.userName,
      status: "pending",
      platform: "discord",
      sdkType: "opencode",
      retryCount: 0,
      createdAt: new Date(),
    });

    await targetThread.post(
      isLinearChannel
        ? `OpenCode session queued for Linear issues in \`${project.name}\`...\n> ${prompt.slice(0, 200)}`
        : `OpenCode session queued for \`${project.folder}\`...\n> ${prompt.slice(0, 200)}`,
    );

    logger.info("Job queued", {
      jobId,
      projectId: project.id,
      threadId: finalThreadId,
    });
  }

  private tryHandlePermissionReply(message: ChatMessage): { handled: boolean } {
    const prompt = message.text.trim().toLowerCase();

    for (const [jobId, pending] of this.pendingPermissions.entries()) {
      if (Date.now() > pending.expiresAt) {
        this.pendingPermissions.delete(jobId);
        continue;
      }

      let reply: PermissionReply | null = null;
      if (
        prompt === "approve" ||
        prompt === "approve once" ||
        prompt === "allow" ||
        prompt === "once"
      ) {
        reply = "once";
      } else if (
        prompt === "approve always" ||
        prompt === "allow always" ||
        prompt === "always"
      ) {
        reply = "always";
      } else if (prompt === "deny" || prompt === "reject") {
        reply = "reject";
      }

      if (reply) {
        this.pendingPermissions.delete(jobId);
        pending.resolve(reply);
        return { handled: true };
      }
    }

    return { handled: false };
  }

  private tryHandleQuestionReply(message: ChatMessage): { handled: boolean } {
    const lines = message.text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return { handled: false };
    }

    for (const [jobId, pending] of this.pendingQuestions.entries()) {
      if (Date.now() > pending.expiresAt) {
        this.pendingQuestions.delete(jobId);
        continue;
      }

      const questions = pending.request.questions;
      const answers: string[][] = [];

      if (questions.length === 1) {
        const question = questions[0];
        const answer = parseQuestionAnswer(question, message.text.trim());
        if (answer) {
          answers.push(answer);
        } else {
          continue;
        }
      } else {
        if (lines.length !== questions.length) {
          continue;
        }

        for (let i = 0; i < questions.length; i++) {
          const answer = parseQuestionAnswer(questions[i], lines[i]);
          if (!answer) {
            continue;
          }
          answers.push(answer);
        }
      }

      if (answers.length === questions.length) {
        this.pendingQuestions.delete(jobId);
        pending.resolve(answers);
        return { handled: true };
      }
    }

    return { handled: false };
  }

  private async postToThread(threadId: string, content: string): Promise<void> {
    await this.discordApi(`/channels/${threadId}/messages`, "POST", {
      content: truncateDiscordMessage(content),
    });
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
          logger.error("Gateway listener failed to start", {
            status: response.status,
            body: text,
          });
          await delay(GATEWAY_RESTART_DELAY_MS);
          continue;
        }

        logger.info("Discord gateway listener running");

        if (listenerTask) {
          await listenerTask;
        } else {
          await delay(GATEWAY_DURATION_MS);
        }
      } catch (error: unknown) {
        if (!this.isStopping) {
          logger.error("Discord gateway listener error", { error });
        }
      } finally {
        this.gatewayAbortController = null;
      }

      if (!this.isStopping) {
        await delay(GATEWAY_RESTART_DELAY_MS);
      }
    }
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

  private extractMentionPrompt(text: string): string | null {
    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }

    const prompt = trimmed
      .replace(/<@!?\d+>/g, " ")
      .replace(/^(?:@\S+\s*)+/, "")
      .trim();

    return prompt || null;
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

    console.log(threadName, "thread name name");

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

    await this.discordApi(`/channels/${created.id}/messages`, "POST", {
      content: formatSessionThreadTitle(prompt),
    });

    await this.renameThread(created.id, prompt);

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

  private async renameThread(threadId: string, prompt: string): Promise<void> {
    const nameSource = prompt.trim() || "session";
    const sanitized = nameSource
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "")
      .slice(0, 60)
      .toLowerCase();
    const threadName = sanitized || `session-${Date.now()}`;

    console.log("[RENAME_THREAD] Attempting to rename thread", {
      threadId,
      threadName,
      prompt: prompt.slice(0, 50),
    });

    try {
      await this.discordApi(`/channels/${threadId}`, "PATCH", {
        name: threadName,
      });
      console.log("[RENAME_THREAD] Success", { threadId, threadName });
    } catch (error) {
      console.log("[RENAME_THREAD] Failed", { threadId, error });
      logger.warn("Failed to rename thread", { threadId, error });
    }
  }

  private async renameThreadIfNeeded(
    threadId: string,
    prompt: string,
  ): Promise<void> {
    try {
      const channel = (await this.discordApi(
        `/channels/${threadId}`,
        "GET",
      )) as { name: string } | null;

      if (!channel?.name) return;

      const isTimestampName =
        /^Thread\s+\d{1,2}\/\d{1,2}\/\d{4},?\s*\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?$/i.test(
          channel.name,
        );

      if (isTimestampName) {
        console.log(
          "[RENAME_THREAD_IF_NEEDED] Found timestamp-named thread, renaming",
          { threadId, currentName: channel.name },
        );
        await this.renameThread(threadId, prompt);
      }
    } catch (error) {
      console.log("[RENAME_THREAD_IF_NEEDED] Failed to check/rename", {
        threadId,
        error,
      });
    }
  }
}

function parseQuestionAnswer(
  question: QuestionRequest["questions"][number],
  rawAnswer: string,
): string[] | null {
  const normalized = rawAnswer.trim();
  if (!normalized) {
    return null;
  }

  if (!question.options.length) {
    return [normalized];
  }

  const candidates = question.multiple
    ? normalized
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [normalized];

  const parsed: string[] = [];

  for (const candidate of candidates) {
    const byIndex = Number.parseInt(candidate, 10);
    if (
      Number.isFinite(byIndex) &&
      byIndex >= 1 &&
      byIndex <= question.options.length
    ) {
      parsed.push(question.options[byIndex - 1].label);
      continue;
    }

    const matchedOption = question.options.find(
      (option) => option.label.toLowerCase() === candidate.toLowerCase(),
    );
    if (matchedOption) {
      parsed.push(matchedOption.label);
      continue;
    }

    if (question.custom !== false) {
      parsed.push(candidate);
      continue;
    }

    return null;
  }

  return parsed.length ? parsed : null;
}

function formatPermissionRequest(request: PermissionRequest): string {
  const lines = [`OpenCode needs approval for \`${request.permission}\`.`];

  if (request.patterns.length) {
    lines.push(
      `Patterns: ${request.patterns.map((item) => `\`${item}\``).join(", ")}`,
    );
  }

  lines.push(
    "Reply in this thread by mentioning the bot with one of: `approve once`, `approve always`, `deny`.",
  );

  return lines.join("\n");
}

function formatQuestionRequest(request: QuestionRequest): string {
  const lines = ["OpenCode needs more input before it can continue."];

  request.questions.forEach((question, index) => {
    lines.push("");
    lines.push(`${index + 1}. **${question.header}**`);
    lines.push(question.question);

    question.options.forEach((option, optionIndex) => {
      lines.push(
        `   ${optionIndex + 1}. ${option.label} - ${option.description}`,
      );
    });
  });

  if (request.questions.length === 1) {
    lines.push("");
    lines.push(
      "Reply in this thread by mentioning the bot with the option number, option label, or a custom answer.",
    );
  } else {
    lines.push("");
    lines.push(
      "Reply in this thread by mentioning the bot and sending one answer per line, in order.",
    );
  }

  return lines.join("\n");
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

function formatSessionThreadTitle(prompt: string): string {
  const SESSION_THREAD_TITLE_PREVIEW_LENGTH = 120;
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "session";
  }

  if (normalized.length <= SESSION_THREAD_TITLE_PREVIEW_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, SESSION_THREAD_TITLE_PREVIEW_LENGTH - 3).trimEnd()}...`;
}
