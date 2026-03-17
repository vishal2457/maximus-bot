import { logger } from "../shared/logger";
import { cronJobRepository } from "../repositories/cron-job-repository";
import { jobQueueRepository } from "../repositories/job-queue-repository";
import { getActiveAgent } from "../agent-manager";

const CHECK_INTERVAL_MS = 60_000;

export class CronScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  start(): void {
    if (this.isRunning) {
      logger.warn("CronScheduler already running");
      return;
    }

    logger.info("Starting CronScheduler");
    this.isRunning = true;
    this.intervalId = setInterval(
      () => this.checkAndExecuteJobs(),
      CHECK_INTERVAL_MS,
    );
    this.checkAndExecuteJobs();
    logger.info("CronScheduler started");
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info("Stopping CronScheduler");
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info("CronScheduler stopped");
  }

  private async checkAndExecuteJobs(): Promise<void> {
    try {
      const dueJobs = cronJobRepository.getDueForExecution();

      for (const job of dueJobs) {
        await this.executeJob(job);
      }
    } catch (error) {
      logger.error("CronScheduler error checking jobs", { error });
    }
  }

  private async executeJob(job: {
    id: string;
    projectId: string;
    title: string;
    prompt: string;
    cronExpression: string;
    authorTag: string;
    channelId: string | null;
    threadId: string | null;
    sdkType: string;
  }): Promise<void> {
    logger.info("Executing cron job", { jobId: job.id, title: job.title });

    const targetChannelId = job.channelId;
    const targetThreadId = job.threadId;

    if (!targetChannelId) {
      logger.warn("Cron job has no channelId, skipping", { jobId: job.id });
      return;
    }

    const jobId = `cron_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    jobQueueRepository.createJob({
      id: jobId,
      projectId: job.projectId,
      channelId: targetChannelId,
      threadId: targetThreadId || targetChannelId,
      sessionId: null,
      prompt: job.prompt,
      authorTag: job.authorTag,
      status: "pending",
      platform: "discord",
      sdkType: job.sdkType as "opencode" | "codex",
      retryCount: 0,
      createdAt: new Date(),
    });

    const nextRun = getNextRunTime(job.cronExpression);
    cronJobRepository.updateNextRun(job.id, nextRun, new Date());

    logger.info("Cron job queued", { jobId, nextRun });
  }
}

export function getNextRunTime(cronExpression: string): Date {
  const parts = cronExpression.split(" ");
  if (parts.length < 5) {
    return new Date(Date.now() + CHECK_INTERVAL_MS);
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const now = new Date();
  const next = new Date(now);

  next.setSeconds(0);
  next.setMilliseconds(0);

  for (let i = 0; i < 60 * 24 * 366; i++) {
    next.setTime(now.getTime() + i * 60_000);

    if (!matchesCronPart(minute, next.getMinutes())) continue;
    if (!matchesCronPart(hour, next.getHours())) continue;
    if (!matchesCronPart(dayOfMonth, next.getDate())) continue;
    if (!matchesCronPart(month, next.getMonth() + 1)) continue;
    if (!matchesCronPart(dayOfWeek, next.getDay())) continue;

    if (next.getTime() > now.getTime()) {
      return next;
    }
  }

  return new Date(now.getTime() + 60 * 60 * 1000);
}

function matchesCronPart(part: string, value: number): boolean {
  if (part === "*") return true;

  if (part.includes(",")) {
    return part.split(",").some((p) => matchesCronPart(p.trim(), value));
  }

  if (part.includes("-")) {
    const [start, end] = part.split("-").map(Number);
    return value >= start && value <= end;
  }

  if (part.includes("/")) {
    const [, step] = part.split("/").map(Number);
    return value % step === 0;
  }

  return parseInt(part, 10) === value;
}

export function parseCronToHuman(cronExpression: string): string {
  const parts = cronExpression.split(" ");
  if (parts.length < 5) return cronExpression;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  if (minute === "*" && hour === "*" && dayOfMonth === "*" && month === "*") {
    if (dayOfWeek === "*") return "Every minute";
    return `Every minute on ${dayNames[parseInt(dayOfWeek)]}`;
  }

  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const h = parseInt(hour);
    const m = parseInt(minute);
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 || 12;
    return `Daily at ${displayHour}:${m.toString().padStart(2, "0")} ${ampm}`;
  }

  if (minute !== "*" && hour !== "*") {
    const h = parseInt(hour);
    const m = parseInt(minute);
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 || 12;
    return `At ${displayHour}:${m.toString().padStart(2, "0")} ${ampm}`;
  }

  return cronExpression;
}

export function formatExecutionTime(cronExpression: string): string {
  const parts = cronExpression.split(" ");
  if (parts.length < 2) return "unknown";

  const [minute, hour] = parts;

  if (minute === "*" && hour === "*") return "every minute";
  if (minute === "*") return `every hour at minute ${hour}`;
  if (hour === "*") return `every minute of hour ${minute}`;

  const h = parseInt(hour);
  const m = parseInt(minute);
  const ampm = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 || 12;

  return `${displayHour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export const cronScheduler = new CronScheduler();
