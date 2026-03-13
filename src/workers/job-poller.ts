import { Worker } from "worker_threads";
import path from "path";
import { jobQueueRepository } from "../repositories/job-queue-repository";
import type { Job, JobPlatform } from "../db/job.schema";
import { logger } from "../shared/logger";
import type { PermissionHandler, PermissionReply } from "../permission-handler";

const WORKER_COUNT = parseInt(process.env.WORKER_COUNT || "4", 10);
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "1000", 10);

function getWorkerPath(): string {
  const distPath = path.join(
    __dirname,
    "..",
    "..",
    "dist",
    "workers",
    "job-worker.js",
  );
  const srcPath = path.join(__dirname, "job-worker.ts");

  try {
    require("fs").accessSync(distPath, require("fs").constants.R_OK);
    return distPath;
  } catch {
    return srcPath;
  }
}

function isDevelopment(): boolean {
  return !__dirname.includes("dist");
}

interface WorkerInfo {
  id: string;
  worker: Worker;
  platform: JobPlatform;
  isIdle: boolean;
  currentJobId: string | null;
  currentThreadId: string | null;
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

type WorkerMessage =
  | ResultMessage
  | ErrorMessage
  | PermissionRequestMessage
  | QuestionRequestMessage;

let permissionHandler: PermissionHandler | null = null;

export function setPermissionHandler(handler: PermissionHandler | null): void {
  permissionHandler = handler;
}

export class JobPoller {
  private workers: Map<string, WorkerInfo> = new Map();
  private isRunning = false;
  private pollIntervalId: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("JobPoller already running");
      return;
    }

    this.isRunning = true;
    logger.info("Starting JobPoller", { workerCount: WORKER_COUNT });

    await this.spawnWorkers();
    this.startPolling();

    logger.info("JobPoller started successfully");
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }

    logger.info("Stopping JobPoller, terminating workers");

    const terminatePromises: Promise<void>[] = [];
    for (const [, workerInfo] of this.workers) {
      terminatePromises.push(this.terminateWorker(workerInfo));
    }

    await Promise.all(terminatePromises);
    this.workers.clear();

    logger.info("JobPoller stopped");
  }

  private async spawnWorkers(): Promise<void> {
    for (let i = 0; i < WORKER_COUNT; i++) {
      const workerId = `worker_${i}_${Date.now()}`;
      const platform: JobPlatform = "discord";

      await this.spawnWorker(workerId, platform);
    }
  }

  private async spawnWorker(
    workerId: string,
    platform: JobPlatform,
  ): Promise<void> {
    const workerPath = getWorkerPath();
    const development = isDevelopment();

    const workerOptions: {
      workerData: { workerId: string; platform: JobPlatform };
      execArgv?: string[];
    } = {
      workerData: {
        workerId,
        platform,
      },
    };

    if (development) {
      workerOptions.execArgv = ["-r", "esbuild-register"];
    }

    const worker = new Worker(workerPath, workerOptions);

    const workerInfo: WorkerInfo = {
      id: workerId,
      worker,
      platform,
      isIdle: true,
      currentJobId: null,
      currentThreadId: null,
    };

    worker.on("message", (message: WorkerMessage) => {
      this.handleWorkerMessage(workerInfo, message);
    });

    worker.on("error", (error: Error) => {
      logger.error("Worker error", { workerId, error: error.message });
      this.handleWorkerCrash(workerInfo, error.message);
    });

    worker.on("exit", (code) => {
      if (code !== 0) {
        logger.warn("Worker exited with non-zero code", { workerId, code });
        this.handleWorkerCrash(workerInfo, `Worker exited with code ${code}`);
      }
    });

    this.workers.set(workerId, workerInfo);
    logger.info("Worker spawned", { workerId, platform });
  }

  private async terminateWorker(workerInfo: WorkerInfo): Promise<void> {
    try {
      await workerInfo.worker.terminate();
    } catch (error) {
      logger.warn("Error terminating worker", {
        workerId: workerInfo.id,
        error,
      });
    }
  }

  private startPolling(): void {
    this.pollIntervalId = setInterval(() => {
      this.pollAndAssignJobs();
    }, POLL_INTERVAL_MS);

    this.pollAndAssignJobs();
  }

  private async pollAndAssignJobs(): Promise<void> {
    const idleWorkers = Array.from(this.workers.values()).filter(
      (w) => w.isIdle,
    );

    if (idleWorkers.length === 0) {
      return;
    }

    for (const workerInfo of idleWorkers) {
      const result = jobQueueRepository.claimNextPendingJob(workerInfo.id);

      if (result.success && result.job) {
        await this.assignJobToWorker(workerInfo, result.job);
      }
    }
  }

  private async assignJobToWorker(
    workerInfo: WorkerInfo,
    job: Job,
  ): Promise<void> {
    workerInfo.isIdle = false;
    workerInfo.currentJobId = job.id;
    workerInfo.currentThreadId = job.threadId;

    logger.info("Assigning job to worker", {
      workerId: workerInfo.id,
      jobId: job.id,
      sdkType: job.sdkType,
    });

    try {
      workerInfo.worker.postMessage({ type: "job", job });
    } catch (error) {
      logger.error("Failed to post job to worker", {
        workerId: workerInfo.id,
        jobId: job.id,
        error,
      });

      workerInfo.isIdle = true;
      workerInfo.currentJobId = null;
      workerInfo.currentThreadId = null;

      jobQueueRepository.markJobFailed(
        job.id,
        `Failed to assign job to worker: ${error}`,
        true,
      );
    }
  }

  private handleWorkerMessage(
    workerInfo: WorkerInfo,
    message: WorkerMessage,
  ): void {
    if (message.type === "result") {
      logger.info("Job completed by worker", {
        workerId: workerInfo.id,
        jobId: message.jobId,
        success: message.success,
      });

      workerInfo.isIdle = true;
      workerInfo.currentJobId = null;
      workerInfo.currentThreadId = null;

      this.pollAndAssignJobs();
    } else if (message.type === "error") {
      logger.error("Worker reported error", {
        workerId: workerInfo.id,
        error: message.error,
      });
    } else if (message.type === "permission_request") {
      this.handlePermissionRequest(workerInfo, message);
    } else if (message.type === "question_request") {
      this.handleQuestionRequest(workerInfo, message);
    }
  }

  private async handlePermissionRequest(
    workerInfo: WorkerInfo,
    message: PermissionRequestMessage,
  ): Promise<void> {
    if (!permissionHandler) {
      logger.warn("No permission handler set, auto-allowing permission", {
        jobId: message.jobId,
        permission: message.permission,
      });
      workerInfo.worker.postMessage({
        type: "permission_response",
        jobId: message.jobId,
        reply: "once",
      } as {
        type: "permission_response";
        jobId: string;
        reply: PermissionReply;
      });
      return;
    }

    try {
      const reply = await permissionHandler.onPermissionRequest({
        jobId: message.jobId,
        threadId: message.threadId,
        sessionId: message.sessionId,
        permission: message.permission,
        patterns: message.patterns,
        metadata: message.metadata,
      });

      workerInfo.worker.postMessage({
        type: "permission_response",
        jobId: message.jobId,
        reply,
      } as {
        type: "permission_response";
        jobId: string;
        reply: PermissionReply;
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error("Permission handler error", {
        jobId: message.jobId,
        error: errMsg,
      });
      workerInfo.worker.postMessage({
        type: "permission_response",
        jobId: message.jobId,
        reply: "reject",
      } as {
        type: "permission_response";
        jobId: string;
        reply: PermissionReply;
      });
    }
  }

  private async handleQuestionRequest(
    workerInfo: WorkerInfo,
    message: QuestionRequestMessage,
  ): Promise<void> {
    if (!permissionHandler) {
      logger.warn("No permission handler set, rejecting question request", {
        jobId: message.jobId,
      });
      workerInfo.worker.postMessage({
        type: "question_response",
        jobId: message.jobId,
        answers: [],
      });
      return;
    }

    try {
      const answers = await permissionHandler.onQuestionRequest({
        jobId: message.jobId,
        threadId: message.threadId,
        sessionId: message.sessionId,
        questions: message.questions,
      });

      workerInfo.worker.postMessage({
        type: "question_response",
        jobId: message.jobId,
        answers,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error("Question handler error", {
        jobId: message.jobId,
        error: errMsg,
      });
      workerInfo.worker.postMessage({
        type: "question_response",
        jobId: message.jobId,
        answers: [],
      });
    }
  }

  private async handleWorkerCrash(
    workerInfo: WorkerInfo,
    error: string,
  ): Promise<void> {
    logger.error("Worker crashed", { workerId: workerInfo.id, error });

    if (workerInfo.currentJobId) {
      const job = jobQueueRepository.getJobById(workerInfo.currentJobId);
      if (job) {
        logger.info("Marking crashed job as failed", {
          jobId: job.id,
          workerId: workerInfo.id,
        });

        jobQueueRepository.markJobFailed(
          job.id,
          `Worker crashed: ${error}`,
          true,
        );
      }
    }

    this.workers.delete(workerInfo.id);

    const platform = workerInfo.platform;
    await this.spawnWorker(workerInfo.id, platform);

    logger.info("Worker respawned", { workerId: workerInfo.id, platform });
  }

  getStats(): { total: number; idle: number; busy: number } {
    const workers = Array.from(this.workers.values());
    return {
      total: workers.length,
      idle: workers.filter((w) => w.isIdle).length,
      busy: workers.filter((w) => !w.isIdle).length,
    };
  }
}
