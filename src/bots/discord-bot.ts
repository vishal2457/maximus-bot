import { ProjectManager } from "../project-manager";
import {
  abortSession,
  formatResultForDiscord,
  type OpenCodeInteractionHandler,
  type OpenCodePermissionReply,
  type OpenCodePermissionRequest,
  type OpenCodeQuestionRequest,
  runOpenCode,
} from "../open-code-runner";
import { MessageJob } from "../types";
import { jobRepository } from "../repositories/job-repository";
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

const GUILD_ID = process.env.DISCORD_GUILD_ID || "";
const DISCORD_TOKEN =
  process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || "";
const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || "";
const DISCORD_APPLICATION_ID = process.env.DISCORD_APPLICATION_ID || "";
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";

const DISCORD_API_BASE = DISCORD_API_BASE_URL;
const DISCORD_MAX_MESSAGE_LENGTH = 2000;
const SESSION_THREAD_TITLE_PREVIEW_LENGTH = 120;
const PENDING_OPENCODE_INPUT_TIMEOUT_MS = parsePositiveInt(
  process.env.PENDING_OPENCODE_INPUT_TIMEOUT_MS,
  15 * 60 * 1000,
);
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

type PendingPermissionInput = {
  kind: "permission";
  request: OpenCodePermissionRequest;
  resolve(value: OpenCodePermissionReply): void;
  reject(error: Error): void;
  expiresAt: number;
};

type PendingQuestionInput = {
  kind: "question";
  request: OpenCodeQuestionRequest;
  resolve(value: string[][]): void;
  reject(error: Error): void;
  expiresAt: number;
};

type PendingOpenCodeInput = PendingPermissionInput | PendingQuestionInput;

type TypingHandle = {
  stop(): void;
};

type ActiveThreadRun = {
  jobId: string;
  projectFolder: string;
  sessionId: string | null;
  controller: AbortController;
  typing: TypingHandle;
  abortRequested: boolean;
};

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
  private channelMetaInFlight = new Map<
    string,
    Promise<CachedChannelMeta | null>
  >();
  private pendingOpenCodeInputs = new Map<string, PendingOpenCodeInput>();
  private pendingAbortConfirmations = new Map<
    string,
    {
      jobId: string;
      sessionId: string | null;
      projectFolder: string;
      resolve(confirmed: boolean): void;
      expiresAt: number;
    }
  >();
  private activeThreadRuns = new Map<string, ActiveThreadRun>();

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

    for (const [threadId, pending] of this.pendingOpenCodeInputs.entries()) {
      this.pendingOpenCodeInputs.delete(threadId);
      pending.reject(new Error("Discord bot is shutting down."));
    }

    for (const [threadId, activeRun] of this.activeThreadRuns.entries()) {
      activeRun.abortRequested = true;
      activeRun.typing.stop();
      activeRun.controller.abort();
      this.activeThreadRuns.delete(threadId);
    }

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
    if (!prompt || prompt.startsWith("#")) {
      return;
    }

    logger.info("Routing message to project workspace", {
      projectId: project.id,
      projectName: project.name,
      folder: project.folder,
    });

    const isLinearChannel = rawChannelId === project.linearIssuesChannelId;
    const resolvedThreadId = await this.resolveThreadId(
      thread.channelId,
      message.threadId,
    );
    const isNewThread = resolvedThreadId === rawChannelId;

    if (
      !isNewThread &&
      (await this.tryHandlePendingOpenCodeInput(
        thread,
        resolvedThreadId,
        prompt,
      ))
    ) {
      return;
    }

    if (
      !isNewThread &&
      (await this.tryHandlePendingAbortConfirmation(
        thread,
        resolvedThreadId,
        prompt,
      ))
    ) {
      return;
    }

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
      logger.warn("Project not found for new session", { projectId });
      return;
    }

    logger.info("Starting new Discord OpenCode session", {
      projectId,
      projectName: project.name,
      authorTag,
      threadId,
    });

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

    await thread.post(
      isLinearChannel
        ? `Starting new OpenCode session for Linear issues in \`${project.name}\`...\n> ${prompt.slice(0, 200)}`
        : `Starting new OpenCode session in \`${project.folder}\`...\n> ${prompt.slice(0, 200)}`,
    );

    const typing = await this.startTypingInterval(threadId);
    const controller = new AbortController();
    this.activeThreadRuns.set(threadId, {
      jobId,
      projectFolder: project.folder,
      sessionId: null,
      controller,
      typing,
      abortRequested: false,
    });

    try {
      logger.info("Calling runOpenCode", { jobId, threadId, projectId });
      const result = await runOpenCode(
        prompt,
        project.folder,
        undefined,
        this.createOpenCodeInteractionHandler(thread, threadId),
        controller.signal,
      );
      logger.info("runOpenCode completed", {
        jobId,
        success: result.success,
        duration: result.duration,
        sessionId: result.sessionId,
      });

      const wasAborted = result.error === "OpenCode run aborted.";
      if (!wasAborted) {
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
        await thread.post(reply);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error("Error in Discord OpenCode job", { jobId, error: errMsg });

      if (errMsg !== "OpenCode run aborted.") {
        jobRepository.updateStatus(jobId, "failed", {
          error: errMsg,
          completedAt: new Date(),
        });
      }

      try {
        if (errMsg !== "OpenCode run aborted.") {
          await thread.post(`Internal error: ${errMsg}`);
        }
      } catch (editErr: unknown) {
        logger.error("Failed to post Discord error message", {
          jobId,
          error: editErr,
        });
      }
    } finally {
      this.cleanupActiveThreadRun(threadId, jobId);
      this.cancelPendingOpenCodeInput(threadId);
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

    const activeRun = this.activeThreadRuns.get(threadId);
    const activeJob =
      activeRun && !activeRun.abortRequested
        ? jobRepository.getActiveByThreadId(threadId)
        : undefined;

    if (activeRun && !activeRun.abortRequested && activeJob) {
      const project = this.projectManager.getById(projectId);
      if (!project) {
        return;
      }

      const promptLower = prompt.toLowerCase().trim();
      const promptSanitized = promptLower.replace(/[*_`~#]/g, "").trim();
      const isAbortCommand =
        promptSanitized === "abort" ||
        promptSanitized === "cancel" ||
        promptSanitized === "kill" ||
        promptSanitized === "stop";

      if (isAbortCommand) {
        const existingConfirmation =
          this.pendingAbortConfirmations.get(threadId);
        if (existingConfirmation) {
          await thread.post(
            "An abort confirmation is already pending. Please confirm or deny first.",
          );
          return;
        }

        await thread.post(
          "A job is currently running. Do you want to abort it?\n\n" +
            "Reply with `@opencode confirm` to abort the running job, or `@opencode deny` to cancel this request.",
        );

        const abortConfirmationPromise = new Promise<boolean>((resolve) => {
          this.pendingAbortConfirmations.set(threadId, {
            jobId: activeRun.jobId,
            sessionId: activeRun.sessionId,
            projectFolder: activeRun.projectFolder,
            resolve,
            expiresAt: Date.now() + PENDING_OPENCODE_INPUT_TIMEOUT_MS,
          });
        });

        const confirmed = await abortConfirmationPromise;
        this.pendingAbortConfirmations.delete(threadId);

        if (!confirmed) {
          await thread.post("Abort cancelled. The existing job will continue.");
          return;
        }

        await thread.post("Aborting the running job...");
        this.abortActiveThreadRun(threadId);
        jobRepository.updateStatus(activeRun.jobId, "failed", {
          sessionId: null,
          error: "Aborted by user",
          completedAt: new Date(),
        });

        if (activeRun.sessionId) {
          const abortResult = await abortSession(
            activeRun.sessionId,
            activeRun.projectFolder,
          );

          if (!abortResult.success) {
            await thread.post(
              `The local run was cancelled, but session cleanup failed: ${abortResult.error}. You can start a new job now.`,
            );
            return;
          }
        }

        await thread.post(
          "The running job has been aborted. You can now start a new job.",
        );
        return;
      }

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

    const isFirstMessageInThread = !previousSessionJob;
    if (isFirstMessageInThread) {
      await this.renameThread(threadId, prompt);
    }

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

    logger.info("Handling existing Discord session job", {
      jobId,
      authorTag,
      threadId,
      promptPreview: prompt.slice(0, 80),
      resuming: Boolean(sessionId),
      sessionId,
    });

    await thread.post(
      isLinearChannel
        ? `Continuing OpenCode session for Linear issues...\n> ${prompt.slice(0, 200)}`
        : `Continuing OpenCode session...\n> ${prompt.slice(0, 200)}`,
    );

    const typing = await this.startTypingInterval(threadId);
    const controller = new AbortController();
    this.activeThreadRuns.set(threadId, {
      jobId,
      projectFolder: project.folder,
      sessionId: sessionId || null,
      controller,
      typing,
      abortRequested: false,
    });

    try {
      logger.info("Calling runOpenCode", { jobId, threadId, projectId });
      const result = await runOpenCode(
        prompt,
        project.folder,
        sessionId,
        this.createOpenCodeInteractionHandler(thread, threadId),
        controller.signal,
      );
      logger.info("runOpenCode completed", {
        jobId,
        success: result.success,
        duration: result.duration,
        sessionId: result.sessionId || sessionId,
      });

      const wasAborted = result.error === "OpenCode run aborted.";
      if (!wasAborted) {
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
        await thread.post(reply);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error("Error in Discord OpenCode job", { jobId, error: errMsg });

      if (errMsg !== "OpenCode run aborted.") {
        jobRepository.updateStatus(jobId, "failed", {
          error: errMsg,
          completedAt: new Date(),
        });
      }

      try {
        if (errMsg !== "OpenCode run aborted.") {
          await thread.post(`Internal error: ${errMsg}`);
        }
      } catch (editErr: unknown) {
        logger.error("Failed to post Discord error message", {
          jobId,
          error: editErr,
        });
      }
    } finally {
      this.cleanupActiveThreadRun(threadId, jobId);
      this.cancelPendingOpenCodeInput(threadId);
    }
  }

  private createOpenCodeInteractionHandler(
    thread: ThreadHandle,
    threadId: string,
  ): OpenCodeInteractionHandler {
    return {
      onPermissionRequest: async (request) => {
        this.attachSessionIdToActiveRun(threadId, request.sessionId);
        return this.waitForPermissionReply(thread, threadId, request);
      },
      onQuestionRequest: async (request) => {
        this.attachSessionIdToActiveRun(threadId, request.sessionId);
        return this.waitForQuestionReply(thread, threadId, request);
      },
    };
  }

  private attachSessionIdToActiveRun(
    threadId: string,
    sessionId: string | undefined,
  ): void {
    if (!sessionId) {
      return;
    }

    const activeRun = this.activeThreadRuns.get(threadId);
    if (!activeRun || activeRun.sessionId === sessionId) {
      return;
    }

    activeRun.sessionId = sessionId;
    jobRepository.updateStatus(activeRun.jobId, "running", { sessionId });
  }

  private abortActiveThreadRun(threadId: string): void {
    const activeRun = this.activeThreadRuns.get(threadId);
    if (!activeRun || activeRun.abortRequested) {
      return;
    }

    activeRun.abortRequested = true;
    activeRun.typing.stop();
    this.cancelPendingOpenCodeInput(
      threadId,
      "The OpenCode run was aborted before the input was used.",
    );
    activeRun.controller.abort();
  }

  private cleanupActiveThreadRun(threadId: string, jobId: string): void {
    const activeRun = this.activeThreadRuns.get(threadId);
    if (!activeRun || activeRun.jobId !== jobId) {
      return;
    }

    activeRun.typing.stop();
    this.activeThreadRuns.delete(threadId);
  }

  private async waitForPermissionReply(
    thread: ThreadHandle,
    threadId: string,
    request: OpenCodePermissionRequest,
  ): Promise<OpenCodePermissionReply> {
    const lines = [`OpenCode needs approval for \`${request.permission}\`.`];

    if (request.patterns.length) {
      lines.push(
        `Patterns: ${request.patterns.map((item) => `\`${item}\``).join(", ")}`,
      );
    }

    lines.push(
      "Reply in this thread by mentioning the bot with one of: `approve once`, `approve always`, `deny`.",
    );

    await thread.post(lines.join("\n"));

    return new Promise<OpenCodePermissionReply>((resolve, reject) => {
      this.registerPendingOpenCodeInput(threadId, {
        kind: "permission",
        request,
        resolve,
        reject,
        expiresAt: Date.now() + PENDING_OPENCODE_INPUT_TIMEOUT_MS,
      });
    });
  }

  private async waitForQuestionReply(
    thread: ThreadHandle,
    threadId: string,
    request: OpenCodeQuestionRequest,
  ): Promise<string[][]> {
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

    await thread.post(lines.join("\n"));

    return new Promise<string[][]>((resolve, reject) => {
      this.registerPendingOpenCodeInput(threadId, {
        kind: "question",
        request,
        resolve,
        reject,
        expiresAt: Date.now() + PENDING_OPENCODE_INPUT_TIMEOUT_MS,
      });
    });
  }

  private registerPendingOpenCodeInput(
    threadId: string,
    pending: PendingOpenCodeInput,
  ): void {
    const existing = this.pendingOpenCodeInputs.get(threadId);
    if (existing) {
      existing.reject(
        new Error("Another approval request replaced the pending one."),
      );
    }

    this.pendingOpenCodeInputs.set(threadId, pending);
  }

  private cancelPendingOpenCodeInput(
    threadId: string,
    reason = "The OpenCode run ended before the input was used.",
  ): void {
    const pending = this.pendingOpenCodeInputs.get(threadId);
    if (!pending) {
      return;
    }

    this.pendingOpenCodeInputs.delete(threadId);
    pending.reject(new Error(reason));
  }

  private async tryHandlePendingOpenCodeInput(
    thread: ThreadHandle,
    threadId: string,
    prompt: string,
  ): Promise<boolean> {
    const pending = this.pendingOpenCodeInputs.get(threadId);
    if (!pending) {
      return false;
    }

    if (Date.now() > pending.expiresAt) {
      this.pendingOpenCodeInputs.delete(threadId);
      pending.reject(new Error("Timed out waiting for Discord input."));
      await thread.post(
        "That approval request expired. Re-run the task if needed.",
      );
      return true;
    }

    if (pending.kind === "permission") {
      const reply = parsePermissionReply(prompt);
      if (!reply) {
        await thread.post(
          "Reply with `approve once`, `approve always`, or `deny` while mentioning the bot.",
        );
        return true;
      }

      this.pendingOpenCodeInputs.delete(threadId);
      pending.resolve(reply);
      await thread.post(`Recorded approval: \`${reply}\`.`);
      return true;
    }

    const answers = parseQuestionAnswers(pending.request, prompt);
    if (!answers) {
      await thread.post(
        pending.request.questions.length === 1
          ? "Could not parse that answer. Reply with the option number, option label, or a custom answer while mentioning the bot."
          : "Could not parse that answer. Reply with one answer per line, in the same order, while mentioning the bot.",
      );
      return true;
    }

    this.pendingOpenCodeInputs.delete(threadId);
    pending.resolve(answers);
    await thread.post("Recorded input. Continuing the OpenCode run.");
    return true;
  }

  private async tryHandlePendingAbortConfirmation(
    thread: ThreadHandle,
    threadId: string,
    prompt: string,
  ): Promise<boolean> {
    const pending = this.pendingAbortConfirmations.get(threadId);
    if (!pending) {
      return false;
    }

    if (Date.now() > pending.expiresAt) {
      this.pendingAbortConfirmations.delete(threadId);
      await thread.post(
        "The abort request timed out. Please try again if you still want to abort.",
      );
      return true;
    }

    const promptLower = prompt.toLowerCase().trim();
    const isConfirm =
      promptLower === "confirm" ||
      promptLower === "yes" ||
      promptLower === "y" ||
      promptLower === "confirm abort";
    const isDeny =
      promptLower === "deny" ||
      promptLower === "no" ||
      promptLower === "n" ||
      promptLower === "cancel" ||
      promptLower === "don't abort" ||
      promptLower === "dont abort";

    if (!isConfirm && !isDeny) {
      await thread.post(
        "Please reply with `@opencode confirm` to abort the job, or `@opencode deny` to cancel this request.",
      );
      return true;
    }

    this.pendingAbortConfirmations.delete(threadId);
    pending.resolve(isConfirm);
    return true;
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

  private async sendTyping(channelId: string): Promise<void> {
    await this.discordApi(`/channels/${channelId}/typing`, "POST");
  }

  private async startTypingInterval(
    channelId: string,
    intervalMs = 5000,
  ): Promise<TypingHandle> {
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

    try {
      await this.discordApi(`/channels/${threadId}`, "PATCH", {
        name: threadName,
      });
    } catch (error) {
      logger.warn("Failed to rename thread", { threadId, error });
    }
  }
}

function parsePermissionReply(prompt: string): OpenCodePermissionReply | null {
  const normalized = prompt.trim().toLowerCase();

  if (
    normalized === "approve" ||
    normalized === "approve once" ||
    normalized === "allow" ||
    normalized === "allow once" ||
    normalized === "once"
  ) {
    return "once";
  }

  if (
    normalized === "approve always" ||
    normalized === "allow always" ||
    normalized === "always"
  ) {
    return "always";
  }

  if (
    normalized === "deny" ||
    normalized === "reject" ||
    normalized === "deny once"
  ) {
    return "reject";
  }

  return null;
}

function parseQuestionAnswers(
  request: OpenCodeQuestionRequest,
  prompt: string,
): string[][] | null {
  const lines = prompt
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return null;
  }

  if (request.questions.length === 1) {
    const answer = parseSingleQuestionAnswer(
      request.questions[0],
      prompt.trim(),
    );
    return answer ? [answer] : null;
  }

  if (lines.length !== request.questions.length) {
    return null;
  }

  const answers: string[][] = [];
  for (let index = 0; index < request.questions.length; index += 1) {
    const parsed = parseSingleQuestionAnswer(
      request.questions[index],
      lines[index],
    );
    if (!parsed) {
      return null;
    }
    answers.push(parsed);
  }

  return answers;
}

function parseSingleQuestionAnswer(
  question: OpenCodeQuestionRequest["questions"][number],
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
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "session";
  }

  if (normalized.length <= SESSION_THREAD_TITLE_PREVIEW_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, SESSION_THREAD_TITLE_PREVIEW_LENGTH - 3).trimEnd()}...`;
}
