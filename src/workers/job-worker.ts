import { parentPort, workerData } from "worker_threads";
import type { Job, JobPlatform, SdkType } from "../db/job.schema";
import { OpencodeSdk } from "../sdk/opencode-sdk";
import { CodexSdk } from "../sdk/codex-sdk";
import type {
  CodingSdkResult,
  CodingSdkInteractionHandler,
} from "../sdk/base-sdk";
import { createNotificationService } from "../services/notification-service";
import { jobQueueRepository } from "../repositories/job-queue-repository";
import { projectManager } from "../project-manager";
import { logger } from "../shared/logger";
import type { PermissionReply } from "../permission-handler";

interface WorkerData {
  workerId: string;
  platform: JobPlatform;
}

interface JobMessage {
  type: "job";
  job: Job;
}

interface PermissionRequestMessage {
  type: "permission_request";
  jobId: string;
  threadId: string;
  sessionId: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
}

interface QuestionRequestMessage {
  type: "question_request";
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

interface PermissionResponseMessage {
  type: "permission_response";
  jobId: string;
  reply: PermissionReply;
}

interface QuestionResponseMessage {
  type: "question_response";
  jobId: string;
  answers: string[][];
}

interface ResultMessage {
  type: "result";
  workerId: string;
  jobId: string;
  success: boolean;
  result?: string;
  error?: string;
  duration?: number;
  sessionId?: string;
}

interface ErrorMessage {
  type: "error";
  workerId: string;
  error: string;
}

type OutgoingMessage =
  | ResultMessage
  | ErrorMessage
  | PermissionRequestMessage
  | QuestionRequestMessage;

const workerData_ = workerData as WorkerData;
const workerId = workerData_.workerId;
const pendingPermissionRequests = new Map<
  string,
  {
    resolve: (reply: PermissionReply) => void;
    reject: (error: Error) => void;
  }
>();
const pendingQuestionRequests = new Map<
  string,
  {
    resolve: (answers: string[][]) => void;
    reject: (error: Error) => void;
  }
>();

logger.info("Worker thread started", {
  workerId,
  platform: workerData_.platform,
});

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

async function executeJob(job: Job): Promise<CodingSdkResult> {
  const project = projectManager.getById(job.projectId);
  if (!project) {
    return {
      success: false,
      output: "",
      error: `Project not found: ${job.projectId}`,
      exitCode: -1,
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
      return new Promise((resolve, reject) => {
        const requestId = `${job.id}_perm_${Date.now()}`;

        pendingPermissionRequests.set(requestId, {
          resolve: (reply: PermissionReply) => {
            pendingPermissionRequests.delete(requestId);
            resolve(
              reply === "always"
                ? "always"
                : reply === "reject"
                  ? "reject"
                  : "once",
            );
          },
          reject: (err: Error) => {
            pendingPermissionRequests.delete(requestId);
            reject(err);
          },
        });

        const message: PermissionRequestMessage = {
          type: "permission_request",
          jobId: job.id,
          threadId: job.threadId,
          sessionId: request.sessionId,
          permission: request.permission,
          patterns: request.patterns,
          metadata: request.metadata,
        };

        parentPort?.postMessage(message);

        setTimeout(
          () => {
            const pending = pendingPermissionRequests.get(requestId);
            if (pending) {
              pendingPermissionRequests.delete(requestId);
              pending.reject(new Error("Permission request timed out"));
            }
          },
          15 * 60 * 1000,
        );
      });
    },

    onQuestionRequest: async (request) => {
      return new Promise((resolve, reject) => {
        const requestId = `${job.id}_quest_${Date.now()}`;

        pendingQuestionRequests.set(requestId, {
          resolve: (answers: string[][]) => {
            pendingQuestionRequests.delete(requestId);
            resolve(answers);
          },
          reject: (err: Error) => {
            pendingQuestionRequests.delete(requestId);
            reject(err);
          },
        });

        const message: QuestionRequestMessage = {
          type: "question_request",
          jobId: job.id,
          threadId: job.threadId,
          sessionId: request.sessionId,
          questions: request.questions,
        };

        parentPort?.postMessage(message);

        setTimeout(
          () => {
            const pending = pendingQuestionRequests.get(requestId);
            if (pending) {
              pendingQuestionRequests.delete(requestId);
              pending.reject(new Error("Question request timed out"));
            }
          },
          15 * 60 * 1000,
        );
      });
    },
  };

  try {
    const result = await codingSdk.run(
      job.prompt,
      project.folder,
      job.sessionId || undefined,
      interactionHandler,
      undefined,
    );

    return result;
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

async function sendResult(
  jobId: string,
  success: boolean,
  result?: string,
  error?: string,
  duration?: number,
  sessionId?: string,
): Promise<void> {
  const message: ResultMessage = {
    type: "result",
    workerId,
    jobId,
    success,
    result,
    error,
    duration,
    sessionId,
  };

  parentPort?.postMessage(message);
}

async function sendError(error: string): Promise<void> {
  const message: ErrorMessage = {
    type: "error",
    workerId,
    error,
  };

  parentPort?.postMessage(message);
}

parentPort?.on(
  "message",
  async (
    message: JobMessage | PermissionResponseMessage | QuestionResponseMessage,
  ) => {
    if (message.type === "permission_response") {
      const permMsg = message as PermissionResponseMessage;
      for (const [requestId, pending] of pendingPermissionRequests.entries()) {
        if (requestId.startsWith(permMsg.jobId)) {
          pending.resolve(permMsg.reply);
          return;
        }
      }
      return;
    }

    if (message.type === "question_response") {
      const questMsg = message as QuestionResponseMessage;
      for (const [requestId, pending] of pendingQuestionRequests.entries()) {
        if (requestId.startsWith(questMsg.jobId)) {
          pending.resolve(questMsg.answers);
          return;
        }
      }
      return;
    }

    if (message.type !== "job") {
      return;
    }

    const job = message.job;
    logger.info("Worker received job", {
      workerId,
      jobId: job.id,
      sdkType: job.sdkType,
    });

    try {
      const result = await executeJob(job);

      if (result.success) {
        const updatedJob = jobQueueRepository.markJobCompleted(
          job.id,
          result.output,
          result.duration,
          result.sessionId,
        );

        const notificationService = createNotificationService(
          job.platform as JobPlatform,
        );
        const project = projectManager.getById(job.projectId);
        const projectName = project?.name || "Unknown";

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

        await sendResult(
          job.id,
          true,
          result.output,
          undefined,
          result.duration,
          result.sessionId,
        );
      } else {
        const canRetry = !result.error?.includes("aborted");
        jobQueueRepository.markJobFailed(
          job.id,
          result.error || "Unknown error",
          canRetry,
        );

        const notificationService = createNotificationService(
          job.platform as JobPlatform,
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

        await sendResult(
          job.id,
          false,
          undefined,
          result.error,
          result.duration,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Worker job execution error", {
        workerId,
        jobId: job.id,
        error: errorMessage,
      });

      const canRetry = !errorMessage.includes("aborted");
      jobQueueRepository.markJobFailed(job.id, errorMessage, canRetry);

      const notificationService = createNotificationService(
        job.platform as JobPlatform,
      );

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

      await sendResult(job.id, false, undefined, errorMessage);
    }
  },
);

parentPort?.on("error", async (error) => {
  logger.error("Worker thread error", { workerId, error: error.message });
  await sendError(error.message);
});

process.on("uncaughtException", async (error) => {
  console.log(error, "i am error");
  
  logger.error("Worker uncaught exception", { workerId, error: error.message });
  await sendError(error.message);
});

function formatResultForPlatform(
  output: string,
  projectName: string,
  success: boolean,
): string {
  const prefix = success ? "✅" : "❌";
  return `${prefix} **${projectName}**\n${output}`;
}

logger.info("Worker thread ready", { workerId });
