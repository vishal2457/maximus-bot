import type { JobPlatform } from "../db/job.schema";
import { DISCORD_API_BASE_URL } from "../shared/constants";

export interface NotificationMessage {
  threadId: string;
  content: string;
}

export interface NotificationService {
  notify(threadId: string, message: string): Promise<void>;
  getPlatformType(): JobPlatform;
}

export class DiscordNotifier implements NotificationService {
  private botToken: string;
  private maxMessageLength = 2000;

  constructor() {
    this.botToken =
      process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || "";
    if (!this.botToken) {
      throw new Error("Discord bot token not configured");
    }
  }

  getPlatformType(): JobPlatform {
    return "discord";
  }

  async notify(threadId: string, message: string): Promise<void> {
    const truncatedMessage =
      message.length > this.maxMessageLength
        ? `${message.slice(0, this.maxMessageLength - 3)}...`
        : message;

    const response = await fetch(
      `${DISCORD_API_BASE_URL}/channels/${threadId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bot ${this.botToken}`,
        },
        body: JSON.stringify({ content: truncatedMessage }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Discord API failed (${response.status}): ${errorText}`);
    }
  }
}


export function createNotificationService(
  platform: JobPlatform,
): NotificationService {
  switch (platform) {
    case "discord":
      return new DiscordNotifier();
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}
