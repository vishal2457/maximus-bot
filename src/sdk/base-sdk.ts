export interface CodingSdkOptions {
  permissionMode?: "ask" | "allow" | "deny";
  maxOutputLength?: number;
  maxPromptLength?: number;
  timeoutMs?: number;
  serverStartTimeoutMs?: number;
  retryCount?: number;
  healthCheckTimeoutMs?: number;
}

export interface CodingSdkResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  duration: number;
  sessionId?: string;
}

export interface CodingSdkPermissionRequest {
  id: string;
  sessionId: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  always: string[];
}

export type CodingSdkPermissionReply = "once" | "always" | "reject";

export interface CodingSdkQuestionOption {
  label: string;
  description: string;
}

export interface CodingSdkQuestion {
  question: string;
  header: string;
  options: CodingSdkQuestionOption[];
  multiple?: boolean;
  custom?: boolean;
}

export interface CodingSdkQuestionRequest {
  id: string;
  sessionId: string;
  questions: CodingSdkQuestion[];
}

export interface CodingSdkInteractionHandler {
  onPermissionRequest?: (
    request: CodingSdkPermissionRequest,
  ) => Promise<CodingSdkPermissionReply>;
  onQuestionRequest?: (
    request: CodingSdkQuestionRequest,
  ) => Promise<string[][]>;
}

export abstract class BaseCodingSdk {
  protected options: CodingSdkOptions;

  constructor(options: CodingSdkOptions = {}) {
    this.options = {
      permissionMode: options.permissionMode ?? "allow",
      maxOutputLength: options.maxOutputLength ?? 1800,
      maxPromptLength: options.maxPromptLength ?? 8000,
      timeoutMs: options.timeoutMs ?? 5 * 60 * 1000,
      serverStartTimeoutMs: options.serverStartTimeoutMs ?? 30_000,
      retryCount: options.retryCount ?? 2,
      healthCheckTimeoutMs: options.healthCheckTimeoutMs ?? 5_000,
      ...options,
    };
  }

  abstract run(
    prompt: string,
    workingDir: string,
    sessionId?: string,
    interactionHandler?: CodingSdkInteractionHandler,
    abortSignal?: AbortSignal,
  ): Promise<CodingSdkResult>;

  abstract abortSession(
    sessionId: string,
    directory: string,
  ): Promise<{ success: boolean; error?: string }>;

  abstract shutdown(): Promise<void>;
}
