export interface OpenCodeResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  duration: number;
  sessionId?: string;
}

export interface MessageJob {
  projectId: string;
  channelId: string;
  threadId: string;
  sessionId?: string;
  prompt: string;
  authorTag: string;
  isLinearChannel: boolean;
}
