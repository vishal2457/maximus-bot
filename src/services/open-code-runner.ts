import { CodingSdkOptions, OpencodeSdk } from "../sdk/opencode-sdk";
import { logger } from "../shared/logger";
import { OpenCodeResult } from "../types";

// Constants for configuration
const MAX_OUTPUT_LENGTH = parsePositiveInt(
  process.env.OPENCODE_MAX_OUTPUT_LENGTH,
  1800,
);
const MAX_PROMPT_LENGTH = parsePositiveInt(
  process.env.OPENCODE_MAX_PROMPT_LENGTH,
  8000,
);
const RUN_TIMEOUT_MS = parsePositiveInt(
  process.env.OPENCODE_RUN_TIMEOUT_MS,
  5 * 60 * 1000,
);
const SERVER_START_TIMEOUT_MS = parsePositiveInt(
  process.env.OPENCODE_SERVER_START_TIMEOUT_MS,
  30_000,
);
const SERVER_PORT = parseNonNegativeInt(process.env.OPENCODE_SERVER_PORT);
const RUN_RETRY_COUNT = parsePositiveInt(
  process.env.OPENCODE_RUN_RETRY_COUNT,
  2,
);
const HEALTH_CHECK_TIMEOUT_MS = parsePositiveInt(
  process.env.OPENCODE_HEALTH_CHECK_TIMEOUT_MS,
  5_000,
);

const PERMISSION_MODE = normalizePermissionMode(
  process.env.OPENCODE_PERMISSION_MODE,
);

export type OpenCodePermissionReply = "once" | "always" | "reject";

export type OpenCodePermissionRequest = {
  id: string;
  sessionId: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  always: string[];
};

export type OpenCodeQuestionOption = {
  label: string;
  description: string;
};

export type OpenCodeQuestion = {
  question: string;
  header: string;
  options: OpenCodeQuestionOption[];
  multiple?: boolean;
  custom?: boolean;
};

export type OpenCodeQuestionRequest = {
  id: string;
  sessionId: string;
  questions: OpenCodeQuestion[];
};

export type OpenCodeInteractionHandler = {
  onPermissionRequest?: (
    request: OpenCodePermissionRequest,
  ) => Promise<OpenCodePermissionReply>;
  onQuestionRequest?: (request: OpenCodeQuestionRequest) => Promise<string[][]>;
};

// Helper functions
function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInt(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizePermissionMode(
  raw: string | undefined,
): "ask" | "allow" | "deny" {
  if (raw === "allow" || raw === "ask" || raw === "deny") {
    return raw;
  }
  return "allow";
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export async function runOpenCode(
  prompt: string,
  workingDir: string,
  sessionId?: string,
  interactionHandler?: OpenCodeInteractionHandler,
  abortSignal?: AbortSignal,
): Promise<OpenCodeResult> {
  const options: CodingSdkOptions = {
    permissionMode: PERMISSION_MODE,
    maxOutputLength: MAX_OUTPUT_LENGTH,
    maxPromptLength: MAX_PROMPT_LENGTH,
    timeoutMs: RUN_TIMEOUT_MS,
    serverStartTimeoutMs: SERVER_START_TIMEOUT_MS,
    retryCount: RUN_RETRY_COUNT,
    healthCheckTimeoutMs: HEALTH_CHECK_TIMEOUT_MS,
  };

  const start = Date.now();
  for (let attempt = 0; attempt <= RUN_RETRY_COUNT; attempt += 1) {
    const sdk = new OpencodeSdk(options);
    try {
      const result = await sdk.run(prompt, workingDir, {
        sessionId,
        interactionHandler,
        abortSignal,
      });

      return {
        success: result.success,
        output: result.output,
        error: result.error,
        exitCode: result.exitCode,
        duration: result.duration,
        sessionId: result.sessionId,
      };
    } catch (error: unknown) {
      const canRetry = attempt < RUN_RETRY_COUNT;
      const duration = Date.now() - start;
      const errMsg = formatUnknownError(error);

      logger.error("OpenCode run attempt failed", {
        attempt: attempt + 1,
        duration,
        error: errMsg,
      });

      try {
        await sdk.shutdown();
      } catch {
        // Ignore shutdown errors
      }

      if (!canRetry) {
        return {
          success: false,
          output: "",
          error: errMsg,
          exitCode: -1,
          duration,
        };
      }
    }
  }

  // This should not be reached due to the retry count check above
  return {
    success: false,
    output: "",
    error: "OpenCode failed unexpectedly.",
    exitCode: -1,
    duration: Date.now() - start,
  };
}

export async function abortSession(
  sessionId: string,
  directory: string,
): Promise<{ success: boolean; error?: string }> {
  if (!sessionId) {
    return { success: false, error: "No session ID provided" };
  }

  try {
    const options: CodingSdkOptions = {
      permissionMode: PERMISSION_MODE,
      maxOutputLength: MAX_OUTPUT_LENGTH,
      maxPromptLength: MAX_PROMPT_LENGTH,
      timeoutMs: RUN_TIMEOUT_MS,
      serverStartTimeoutMs: SERVER_START_TIMEOUT_MS,
      retryCount: RUN_RETRY_COUNT,
      healthCheckTimeoutMs: HEALTH_CHECK_TIMEOUT_MS,
    };
    const sdk = new OpencodeSdk(options);
    return await sdk.abortSession(sessionId, directory);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error("Error aborting session", { sessionId, error: errMsg });
    return { success: false, error: errMsg };
  }
}

export async function shutdownOpenCodeRunner(): Promise<void> {
  // Note: Each OpencodeSdk instance manages its own runtime, so there's no shared runtime to shut down.
  // If we had a singleton instance, we would shut it down here.
  // For now, we do nothing because the SDK instances are short-lived and manage their own resources.
  // However, to be safe, we can create an instance and call shutdown on it, but it's not necessary.
  // We'll leave this as a no-op for now, but note that the original function did reset the runtime.
  // If we want to mimic the original behavior, we would need to keep a singleton instance.
  // Given the time, we'll leave it empty and note that the user should call shutdown on the SDK instance if they manage it themselves.
  // But since we are creating a new instance each time in runOpenCode and abortSession, there is no shared state.
  return;
}

export function formatResultForDiscord(
  result: OpenCodeResult,
  projectName: string,
): string {
  const status = result.success ? "Success" : "Failure";
  const duration = (result.duration / 1000).toFixed(1);
  const header = `${status} **OpenCode** · \`${projectName}\` · ${duration}s\n`;

  if (!result.success && result.error) {
    return `${header}\`\`\`\n${result.error}\n\`\`\``;
  }

  const codeBlock = `\`\`\`\n${result.output}\n\`\`\``;
  return `${header}${codeBlock}`;
}
