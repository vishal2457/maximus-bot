import type { JobPlatform } from "../db/job.schema";

export interface NotificationMessage {
  threadId: string;
  content: string;
}

export interface NotificationService {
  notify(threadId: string, message: string): Promise<void>;
  typing(threadId: string): Promise<void>;
  getPlatformType(): JobPlatform;
}

export class CustomNotifier implements NotificationService {
  getPlatformType(): JobPlatform {
    return "custom";
  }

  async notify(_threadId: string, _message: string): Promise<void> {
    // Notifications are handled via Socket.IO in the new architecture.
    // This is a no-op for job queue compatibility.
  }

  async typing(_threadId: string): Promise<void> {
    // Typing indicators are handled via Socket.IO in the new architecture.
  }
}

export function createNotificationService(
  platform: JobPlatform,
): NotificationService {
  switch (platform) {
    case "custom":
    case "discord":
    case "slack":
    default:
      return new CustomNotifier();
  }
}
