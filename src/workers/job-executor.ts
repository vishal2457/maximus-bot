import type { Job, JobPlatform, SdkType } from "../db/job.schema";
import { projectManager } from "../project-manager";
import { jobQueueRepository } from "../repositories/job-queue-repository";
import type {
  CodingSdkInteractionHandler
} from "../sdk/base-sdk";
import { CodexSdk } from "../sdk/codex-sdk";
import { OpencodeSdk } from "../sdk/opencode-sdk";
import { createNotificationService } from "../services/notification-service";
import { logger } from "../shared/logger";

export interface PermissionRequest {
  jobId: string;
  threadId: string;
  sessionId: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
}

export interface QuestionRequest {
  jobId: string;
  threadId: string;
  sessionId: string;
  questions: Array<{
    header: string;
    question: string;
    options: Array<{ label: string; description: string }>;
    multiple?: boolean;
    custom?: boolean;
  }>;
}

export interface JobResult {
  success: boolean;
  output?: string;
  error?: string;
  duration?: number;
  sessionId?: string;
}

export type PermissionHandlerCallback = (
  request: PermissionRequest,
) => Promise<"once" | "always" | "reject">;

export type QuestionHandlerCallback = (
  request: QuestionRequest,
) => Promise<string[][]>;

function createSdk(sdkType: SdkType): OpencodeSdk | CodexSdk {
  if (sdkType === "opencode") {
    return new OpencodeSdk({
      permissionMode: "ask",
      maxOutputLength: 1800,
      maxPromptLength: 8000,
      timeoutMs: 5 * 60 * 1000,
      serverStartTimeoutMs: 30_000,
      retryCount: 2,
      healthCheckTimeoutMs: 5_000,
    });
  } else if (sdkType === "codex") {
    return new CodexSdk({
      permissionMode: "ask",
      maxOutputLength: 1800,
      maxPromptLength: 8000,
      timeoutMs: 5 * 60 * 1000,
      serverStartTimeoutMs: 30_000,
      retryCount: 2,
      healthCheckTimeoutMs: 5_000,
    });
  } else {
    throw new Error(`Unknown SDK type: ${sdkType}`);
  }
}

function formatResultForPlatform(
  output: string,
  projectName: string,
  success: boolean,
): string {
  const prefix = success ? "✅" : "❌";
  return `${prefix} **${projectName}**\n${output}`;
}

export async function executeJob(
  job: Job,
  permissionHandler: PermissionHandlerCallback,
  questionHandler: QuestionHandlerCallback,
): Promise<JobResult> {
  const project = projectManager.getById(job.projectId);
  if (!project) {
    return {
      success: false,
      error: `Project not found: ${job.projectId}`,
      duration: 0,
    };
  }

  const codingSdk = createSdk(job.sdkType as SdkType);

  const notificationService = createNotificationService(
    job.platform as JobPlatform,
  );

  try {
    await notificationService.notify(
      job.threadId,
      job.status === "running"
        ? `Running ${job.sdkType}...`
        : `Retrying (attempt ${job.retryCount + 1})...`,
    );
  } catch (notifyError) {
    logger.warn("Failed to send start notification", {
      jobId: job.id,
      error: notifyError,
    });
  }

  const interactionHandler: CodingSdkInteractionHandler = {
    onPermissionRequest: async (request) => {
      return permissionHandler({
        jobId: job.id,
        threadId: job.threadId,
        sessionId: request.sessionId,
        permission: request.permission,
        patterns: request.patterns,
        metadata: request.metadata,
      });
    },

    onQuestionRequest: async (request) => {
      return questionHandler({
        jobId: job.id,
        threadId: job.threadId,
        sessionId: request.sessionId,
        questions: request.questions,
      });
    },
  };

  try {
    const startTime = Date.now();
    const result = await codingSdk.run(
      job.prompt,
      project.folder,
      job.sessionId || undefined,
      interactionHandler,
      undefined,
    );
    const duration = Date.now() - startTime;

    if (result.success) {
      jobQueueRepository.markJobCompleted(
        job.id,
        result.output,
        duration,
        result.sessionId,
      );

      const projectName = project.name || "Unknown";
      const formattedMessage = formatResultForPlatform(
        result.output,
        projectName,
        result.success,
      );

      try {
        await notificationService.notify(job.threadId, formattedMessage);
      } catch (notifyError) {
        logger.warn("Failed to send completion notification", {
          jobId: job.id,
          error: notifyError,
        });
      }

      return {
        success: true,
        output: result.output,
        duration,
        sessionId: result.sessionId,
      };
    } else {
      const canRetry = !result.error?.includes("aborted");
      jobQueueRepository.markJobFailed(
        job.id,
        result.error || "Unknown error",
        canRetry,
      );

      try {
        await notificationService.notify(
          job.threadId,
          `Job failed: ${result.error}`,
        );
      } catch (notifyError) {
        logger.warn("Failed to send failure notification", {
          jobId: job.id,
          error: notifyError,
        });
      }

      return {
        success: false,
        error: result.error,
        duration,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Job execution error", {
      jobId: job.id,
      error: errorMessage,
    });

    const canRetry = !errorMessage.includes("aborted");
    jobQueueRepository.markJobFailed(job.id, errorMessage, canRetry);

    try {
      await notificationService.notify(
        job.threadId,
        `Internal error: ${errorMessage}`,
      );
    } catch (notifyError) {
      logger.warn("Failed to send error notification", {
        jobId: job.id,
        error: notifyError,
      });
    }

    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    try {
      await codingSdk.shutdown();
    } catch (shutdownError) {
      logger.warn("Failed to shutdown SDK", {
        jobId: job.id,
        error: shutdownError,
      });
    }
  }
}
