import { jobQueueRepository } from "../repositories/job-queue-repository";
import type { Job } from "../db/job.schema";
import { logger } from "../shared/logger";
import type { PermissionHandler } from "../permission-handler";
import {
  executeJob,
  type PermissionRequest,
  type QuestionRequest,
} from "./job-executor";

const CONCURRENCY = parseInt(process.env.WORKER_COUNT || "4", 10);
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "1000", 10);

type PQueueType = {
  concurrency: number;
  pending: number;
  size: number;
  pause(): void;
  onIdle(): Promise<void>;
  add<T>(task: () => Promise<T>): Promise<T>;
};

async function createPQueue(concurrency: number): Promise<PQueueType> {
  const { default: PQueue } = await import("p-queue");
  return new PQueue({ concurrency }) as unknown as PQueueType;
}

let permissionHandler: PermissionHandler | null = null;

export function setPermissionHandler(handler: PermissionHandler | null): void {
  permissionHandler = handler;
}

export class JobQueueManager {
  private queue: PQueueType | null = null;
  private isRunning = false;
  private pollIntervalId: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("JobQueueManager already running");
      return;
    }

    this.queue = await createPQueue(CONCURRENCY);
    this.isRunning = true;
    logger.info("Starting JobQueueManager", { concurrency: CONCURRENCY });

    this.startPolling();

    logger.info("JobQueueManager started successfully");
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.queue) {
      return;
    }

    this.isRunning = false;

    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }

    this.queue.pause();
    await this.queue.onIdle();

    logger.info("JobQueueManager stopped");
  }

  private startPolling(): void {
    this.pollIntervalId = setInterval(() => {
      this.pollAndProcessJobs();
    }, POLL_INTERVAL_MS);

    this.pollAndProcessJobs();
  }

  private async pollAndProcessJobs(): Promise<void> {
    if (!this.queue) return;

    const pendingJobs = jobQueueRepository.getPendingJobs(CONCURRENCY);

    for (const job of pendingJobs) {
      const workerId = `worker_${job.id}_${Date.now()}`;
      const claimResult = jobQueueRepository.claimJobAtomic(job.id, workerId);

      if (claimResult.success && claimResult.job) {
        this.queue.add(() => this.processJob(claimResult.job!));
      }
    }
  }

  private async processJob(job: Job): Promise<void> {
    logger.info("Processing job", {
      jobId: job.id,
      sdkType: job.sdkType,
    });

    const permissionCallback = async (
      request: PermissionRequest,
    ): Promise<"once" | "always" | "reject"> => {
      if (!permissionHandler) {
        logger.warn("No permission handler set, auto-allowing permission", {
          jobId: request.jobId,
          permission: request.permission,
        });
        return "once";
      }

      try {
        return await permissionHandler.onPermissionRequest({
          jobId: request.jobId,
          threadId: request.threadId,
          sessionId: request.sessionId,
          permission: request.permission,
          patterns: request.patterns,
          metadata: request.metadata,
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error("Permission handler error", {
          jobId: request.jobId,
          error: errMsg,
        });
        return "reject";
      }
    };

    const questionCallback = async (
      request: QuestionRequest,
    ): Promise<string[][]> => {
      if (!permissionHandler) {
        logger.warn("No permission handler set, returning empty answers", {
          jobId: request.jobId,
        });
        return [];
      }

      try {
        return await permissionHandler.onQuestionRequest({
          jobId: request.jobId,
          threadId: request.threadId,
          sessionId: request.sessionId,
          questions: request.questions,
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error("Question handler error", {
          jobId: request.jobId,
          error: errMsg,
        });
        return [];
      }
    };

    try {
      await executeJob(job, permissionCallback, questionCallback);
      logger.info("Job completed", { jobId: job.id });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error("Job processing failed", { jobId: job.id, error: errMsg });
    }
  }

  getStats(): { total: number; idle: number; busy: number; pending: number } {
    if (!this.queue) {
      return { total: CONCURRENCY, idle: CONCURRENCY, busy: 0, pending: 0 };
    }
    const pending = this.queue.pending;
    const queueSize = this.queue.size;
    return {
      total: CONCURRENCY,
      idle: CONCURRENCY - pending,
      busy: pending,
      pending: queueSize,
    };
  }
}
