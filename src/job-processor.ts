import { getDb } from "./db";
import {
  JobQueueManager,
  setPermissionHandler,
} from "./workers/job-queue-manager";
import { cronScheduler } from "./workers/cron-scheduler";
import { logger } from "./shared/logger";
import type { PermissionHandler } from "./permission-handler";

class JobProcessor {
  private queueManager: JobQueueManager;
  private isRunning = false;

  constructor() {
    this.queueManager = new JobQueueManager();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("JobProcessor already running");
      return;
    }

    logger.info("Initializing JobProcessor");

    getDb();

    await this.queueManager.start();
    cronScheduler.start();
    this.isRunning = true;

    logger.info("JobProcessor started");
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info("Stopping JobProcessor");
    cronScheduler.stop();
    await this.queueManager.stop();
    this.isRunning = false;

    logger.info("JobProcessor stopped");
  }

  setPermissionHandler(handler: PermissionHandler | null): void {
    setPermissionHandler(handler);
  }

  getStats() {
    return this.queueManager.getStats();
  }
}

export const jobProcessor = new JobProcessor();
