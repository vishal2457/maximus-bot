import { getDb } from "./db";
import { JobPoller, setPermissionHandler } from "./workers/job-poller";
import { logger } from "./shared/logger";
import type { PermissionHandler } from "./permission-handler";

class JobProcessor {
  private poller: JobPoller;
  private isRunning = false;

  constructor() {
    this.poller = new JobPoller();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("JobProcessor already running");
      return;
    }

    logger.info("Initializing JobProcessor");

    getDb();

    await this.poller.start();
    this.isRunning = true;

    logger.info("JobProcessor started");
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info("Stopping JobProcessor");
    await this.poller.stop();
    this.isRunning = false;

    logger.info("JobProcessor stopped");
  }

  setPermissionHandler(handler: PermissionHandler | null): void {
    setPermissionHandler(handler);
  }

  getStats() {
    return this.poller.getStats();
  }
}

export const jobProcessor = new JobProcessor();
