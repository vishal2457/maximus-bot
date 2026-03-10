import { ProjectManager } from "./project-manager";
import { runOpenCode, formatResultForDiscord } from "./open-code-runner";
import { MessageJob, Project } from "./types";

const CATEGORY_NAME = process.env.DISCORD_CATEGORY_NAME || "OpenCode Projects";
const GUILD_ID = process.env.DISCORD_GUILD_ID || "";
const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || "";
const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || "";
const DISCORD_APPLICATION_ID = process.env.DISCORD_APPLICATION_ID || "";
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const DISCORD_MAX_MESSAGE_LENGTH = 2000;
const GATEWAY_DURATION_MS = parsePositiveInt(process.env.DISCORD_GATEWAY_DURATION_MS, 10 * 60 * 1000);
const GATEWAY_RESTART_DELAY_MS = parsePositiveInt(
  process.env.DISCORD_GATEWAY_RESTART_DELAY_MS,
  2_000
);

// Simple in-memory queue to prevent concurrent runs per channel
const activeJobs = new Set<string>();

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
    webhookUrl?: string
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
      options?: { waitUntil?: (task: Promise<unknown>) => void }
    ): Promise<Response>;
  };
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  onNewMessage(pattern: RegExp, handler: (thread: ChatThread, message: ChatMessage) => Promise<void>): void;
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

  constructor(projectManager: ProjectManager) {
    this.projectManager = projectManager;
  }

  isReady(): boolean {
    return this.isInitialized && !this.isStopping;
  }

  async start(): Promise<void> {
    if (!DISCORD_TOKEN) {
      throw new Error("DISCORD_BOT_TOKEN or DISCORD_TOKEN is not set in environment");
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

    const channels = (await this.discordApi(`/guilds/${GUILD_ID}/channels`, "GET")) as Array<{
      id: string;
      name: string;
      type: number;
      parent_id?: string;
    }>;

    let category = channels.find((c) => c.type === 4 && c.name === CATEGORY_NAME);

    if (!category) {
      category = (await this.discordApi(`/guilds/${GUILD_ID}/channels`, "POST", {
        name: CATEGORY_NAME,
        type: 4,
      })) as { id: string; name: string; type: number };

      console.log(`[Discord] Created category: ${CATEGORY_NAME}`);
    }

    const projects = this.projectManager.getAll();

    for (const project of projects) {
      let channel = channels.find(
        (c) =>
          c.type === 0 &&
          c.name === project.discordChannelName &&
          c.parent_id === category!.id
      );

      if (!channel) {
        channel = (await this.discordApi(`/guilds/${GUILD_ID}/channels`, "POST", {
          name: project.discordChannelName,
          type: 0,
          parent_id: category.id,
          topic: `OpenCode workspace for: ${project.description} | Folder: ${project.folder}`,
        })) as {
          id: string;
          name: string;
          type: number;
          parent_id?: string;
        };

        console.log(`[Discord] Created channel #${project.discordChannelName}`);
        channels.push(channel);


        await this.postToChannel(
          channel.id,
          `**${project.name}** workspace ready.\n` +
            `Folder: \`${project.folder}\`\n` +
            `${project.description}\n\n` +
            `Send any message here to run OpenCode in this project. Prefix with \`#\` to leave a note.`
        );
      }

      if (project.discordChannelId !== channel.id) {
        this.projectManager.updateChannelId(project.id, channel.id);
      }
    }

    console.log(`[Discord] Sync complete. ${projects.length} project channel(s) ready.`);
  }

  private async ensureBot(): Promise<ChatBotLike> {
    if (this.bot) {
      return this.bot;
    }

    const [{ Chat }, { createDiscordAdapter }, { createMemoryState }] = await Promise.all([
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

  private async handleIncomingMessage(thread: ChatThread, message: ChatMessage): Promise<void> {
    const rawChannelId = this.resolveChannelId(thread.channelId, message.threadId);
    if (!rawChannelId) {
      return;
    }

    const project = this.projectManager.getByChannelId(rawChannelId);
    if (!project) {
      return;
    }

    const prompt = message.text.trim();
    if (!prompt || prompt.startsWith("#")) {
      return;
    }

    await this.handleProjectMessage(thread, {
      projectId: project.id,
      channelId: rawChannelId,
      messageId: message.threadId,
      prompt,
      authorTag: message.author.fullName || message.author.userName,
    });
  }

  private async handleProjectMessage(thread: ChatThread, job: MessageJob): Promise<void> {
    const { projectId, channelId, prompt, authorTag } = job;

    if (activeJobs.has(channelId)) {
      await thread.post("A job is already running in this channel. Please wait.");
      return;
    }

    const project = this.projectManager.getById(projectId);
    if (!project) {
      return;
    }

    activeJobs.add(channelId);

    console.log(
      `[Discord] Job from ${authorTag} in #${project.discordChannelName}: ${prompt.slice(0, 80)}`
    );

    const thinkingMsg = await thread.post(
      `Running OpenCode in \`${project.folder}\`...\n> ${prompt.slice(0, 200)}`
    );

    try {
      const result = await runOpenCode(prompt, project.folder);
      const reply = formatResultForDiscord(result, project.name);
      await thinkingMsg.edit(reply);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await thinkingMsg.edit(`Internal error: ${errMsg}`);
    } finally {
      activeJobs.delete(channelId);
    }
  }

  private resolveChannelId(channelId: string, threadId: string): string | null {
    if (!this.bot) {
      return null;
    }

    const adapter = this.bot.adapters.get("discord");
    if (!adapter) {
      return null;
    }

    try {
      const channel = adapter.decodeThreadId(channelId);
      if (channel.channelId) {
        return channel.channelId;
      }
    } catch {
      // no-op
    }

    try {
      const thread = adapter.decodeThreadId(threadId);
      if (thread.channelId) {
        return thread.channelId;
      }
    } catch {
      // no-op
    }

    return null;
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
          DISCORD_WEBHOOK_URL || undefined
        );

        if (!response.ok) {
          const text = await response.text();
          console.error(`[Discord] Gateway listener failed to start: ${response.status} ${text}`);
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

  private async discordApi(path: string, method: "GET" | "POST", body?: unknown): Promise<unknown> {
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
      throw new Error(`Discord API ${method} ${path} failed (${response.status}): ${text}`);
    }

    if (response.status === 204) {
      return {};
    }

    return response.json();
  }
}

async function loadModule<TModule>(specifier: string): Promise<TModule> {
  const dynamicImport = new Function(
    "moduleSpecifier",
    "return import(moduleSpecifier)"
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
