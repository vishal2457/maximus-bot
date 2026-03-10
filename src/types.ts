export interface Project {
  id: string;
  name: string;
  description: string;
  folder: string;
  discordChannelName: string;
  discordChannelId: string;
}

export interface OpenCodeResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  duration: number;
}

export interface MessageJob {
  projectId: string;
  channelId: string;
  messageId: string;
  prompt: string;
  authorTag: string;
}
