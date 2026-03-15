import Database from "better-sqlite3";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { jobs, type Job, type NewJob } from "../db/job.schema";
import { logger } from "../shared/logger";

const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || "3", 10);

export interface JobClaimResult {
  success: boolean;
  job?: Job;
}

export class JobQueueRepository {
  private db = getDb();

  getPendingJobs(limit = 10): Job[] {
    return this.db
      .select()
      .from(jobs)
      .where(eq(jobs.status, "pending"))
      .orderBy(desc(jobs.createdAt))
      .limit(limit)
      .all();
  }

  getRunningJobs(): Job[] {
    return this.db.select().from(jobs).where(eq(jobs.status, "running")).all();
  }

  getJobsByWorkerId(workerId: string): Job[] {
    return this.db.select().from(jobs).where(eq(jobs.workerId, workerId)).all();
  }

  getJobById(id: string): Job | undefined {
    return this.db.select().from(jobs).where(eq(jobs.id, id)).get();
  }

  claimJobAtomic(jobId: string, workerId: string): JobClaimResult {
    const sqlite = getDb().$client as Database.Database;

    const updateResult = sqlite
      .prepare(
        `
      UPDATE jobs 
      SET status = 'running', worker_id = ?, started_at = ?
      WHERE id = ? AND status = 'pending'
    `,
      )
      .run(workerId, Date.now(), jobId);

    if (updateResult.changes === 0) {
      return { success: false };
    }

    const claimedJob = this.getJobById(jobId);
    if (!claimedJob) {
      return { success: false };
    }

    return { success: true, job: claimedJob };
  }

  claimNextPendingJob(workerId: string): JobClaimResult {
    const pendingJobs = this.getPendingJobs(1);
    if (pendingJobs.length === 0) {
      return { success: false };
    }

    return this.claimJobAtomic(pendingJobs[0].id, workerId);
  }

  markJobCompleted(
    jobId: string,
    result: string,
    duration: number,
    sessionId?: string,
  ): Job | undefined {
    this.db
      .update(jobs)
      .set({
        status: "completed",
        result,
        duration,
        sessionId: sessionId || null,
        completedAt: new Date(),
        workerId: null,
      })
      .where(eq(jobs.id, jobId))
      .run();

    return this.getJobById(jobId);
  }

  markJobFailed(
    jobId: string,
    error: string,
    canRetry: boolean,
  ): Job | undefined {
    const job = this.getJobById(jobId);
    if (!job) {
      return undefined;
    }

    const newRetryCount = job.retryCount + 1;
    const shouldRetry = canRetry && newRetryCount < MAX_RETRIES;

    if (shouldRetry) {
      this.db
        .update(jobs)
        .set({
          status: "pending",
          error,
          retryCount: newRetryCount,
          startedAt: null,
          workerId: null,
        })
        .where(eq(jobs.id, jobId))
        .run();

      logger.info("Job will be retried", {
        jobId,
        retryCount: newRetryCount,
        maxRetries: MAX_RETRIES,
      });
    } else {
      this.db
        .update(jobs)
        .set({
          status: "failed",
          error,
          completedAt: new Date(),
          workerId: null,
        })
        .where(eq(jobs.id, jobId))
        .run();

      logger.error("Job permanently failed", {
        jobId,
        retryCount: newRetryCount,
        error,
      });
    }

    return this.getJobById(jobId);
  }

  createJob(job: NewJob): Job {
    this.db.insert(jobs).values(job).run();
    return this.getJobById(job.id)!;
  }

  getLatestCompletedJobByThreadId(threadId: string): Job | undefined {
    return this.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.threadId, threadId), eq(jobs.status, "completed")))
      .orderBy(desc(jobs.completedAt))
      .limit(1)
      .get();
  }

  getJobStats(): {
    pending: number;
    running: number;
    completed: number;
    failed: number;
  } {
    const result = this.db
      .select({
        status: jobs.status,
        count: sql<number>`count(*)`,
      })
      .from(jobs)
      .groupBy(jobs.status)
      .all();

    const stats = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
    };

    for (const row of result) {
      if (row.status === "pending") stats.pending = Number(row.count);
      else if (row.status === "running") stats.running = Number(row.count);
      else if (row.status === "completed") stats.completed = Number(row.count);
      else if (row.status === "failed") stats.failed = Number(row.count);
    }

    return stats;
  }
}

export const jobQueueRepository = new JobQueueRepository();
