import {
  Client,
  GatewayIntentBits,
  Guild,
  TextChannel,
  ChannelType,
  CategoryChannel,
  Message,
  Partials,
  ActivityType,
} from "discord.js";
import { ProjectManager } from "./projectManager";
import { runOpenCode, formatResultForDiscord } from "./openCodeRunner";
import { MessageJob } from "./types";

const CATEGORY_NAME = process.env.DISCORD_CATEGORY_NAME || "OpenCode Projects";
const GUILD_ID = process.env.DISCORD_GUILD_ID!;

// Simple in-memory queue to prevent concurrent runs per channel
const activeJobs = new Set<string>();

export class DiscordBot {
  public client: Client;
  private projectManager: ProjectManager;
  private guild: Guild | null = null;

  constructor(projectManager: ProjectManager) {
    this.projectManager = projectManager;

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel, Partials.Message],
    });

    this.registerEvents();
  }

  private registerEvents(): void {
    this.client.once("clientReady", async () => {
      console.log(`[Discord] Logged in as ${this.client.user?.tag}`);
      this.client.user?.setActivity("OpenCode projects", { type: ActivityType.Watching });

      this.guild = await this.client.guilds.fetch(GUILD_ID);
      if (!this.guild) {
        console.error(`[Discord] Guild ${GUILD_ID} not found!`);
        return;
      }

      await this.syncChannels();
    });

    this.client.on("messageCreate", async (message: Message) => {
      if (message.author.bot) return;
      if (!message.guild) return;

      const project = this.projectManager.getByChannelId(message.channelId);
      if (!project) return;

      // Ignore messages that start with # (comments/notes)
      if (message.content.startsWith("#")) return;

      const prompt = message.content.trim();
      if (!prompt) return;

      await this.handleProjectMessage({
        projectId: project.id,
        channelId: message.channelId,
        messageId: message.id,
        prompt,
        authorTag: message.author.tag,
      });
    });

    this.client.on("error", (err) => {
      console.error("[Discord] Client error:", err);
    });
  }

  private async handleProjectMessage(job: MessageJob): Promise<void> {
    const { projectId, channelId, prompt, authorTag } = job;

    if (activeJobs.has(channelId)) {
      const channel = (await this.client.channels.fetch(channelId)) as TextChannel;
      await channel.send("⏳ A job is already running in this channel. Please wait.");
      return;
    }

    const project = this.projectManager.getById(projectId);
    if (!project) return;

    activeJobs.add(channelId);

    const channel = (await this.client.channels.fetch(channelId)) as TextChannel;

    console.log(`[Discord] Job from ${authorTag} in #${project.discordChannelName}: ${prompt.slice(0, 80)}`);

    const thinkingMsg = await channel.send(
      `Running OpenCode in \`${project.folder}\`...\n> ${prompt.slice(0, 200)}`
    );

    try {
      const result = await runOpenCode(prompt, project.folder);
      const reply = formatResultForDiscord(result, project.name);
      await thinkingMsg.edit(reply);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await thinkingMsg.edit(`❌ **Internal error:** ${errMsg}`);
    } finally {
      activeJobs.delete(channelId);
    }
  }

  async syncChannels(): Promise<void> {
    if (!this.guild) {
      console.error("[Discord] syncChannels called before guild is ready");
      return;
    }

    console.log("[Discord] Syncing channels with projects.json...");

    // Fetch or create the category
    await this.guild.channels.fetch();
    let category = this.guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME
    ) as CategoryChannel | undefined;

    if (!category) {
      category = await this.guild.channels.create({
        name: CATEGORY_NAME,
        type: ChannelType.GuildCategory,
      });
      console.log(`[Discord] Created category: ${CATEGORY_NAME}`);
    }

    const projects = this.projectManager.getAll();

    for (const project of projects) {
      // Check if channel already exists by name
      let channel = this.guild.channels.cache.find(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.name === project.discordChannelName &&
          (c as TextChannel).parentId === category!.id
      ) as TextChannel | undefined;

      if (!channel) {
        // Create new channel
        channel = await this.guild.channels.create({
          name: project.discordChannelName,
          type: ChannelType.GuildText,
          parent: category.id,
          topic: `OpenCode workspace for: ${project.description} | Folder: ${project.folder}`,
        });
        console.log(`[Discord] Created channel #${project.discordChannelName}`);

        await channel.send(
          `👋 **${project.name}** workspace ready!\n` +
          `📁 Folder: \`${project.folder}\`\n` +
          `📝 ${project.description}\n\n` +
          `Send any message here to run OpenCode in this project. Prefix with \`#\` to leave a note.`
        );
      }

      // Persist the channelId back to projects.json if needed
      if (project.discordChannelId !== channel.id) {
        this.projectManager.updateChannelId(project.id, channel.id);
      }
    }

    console.log(`[Discord] Sync complete. ${projects.length} project channel(s) ready.`);
  }

  async start(): Promise<void> {
    const token = process.env.DISCORD_TOKEN;
    if (!token) throw new Error("DISCORD_TOKEN is not set in environment");
    await this.client.login(token);
  }
}
