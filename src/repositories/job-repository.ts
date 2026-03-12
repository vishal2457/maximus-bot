import { eq, desc, and, isNotNull } from "drizzle-orm";
import { getDb } from "../db";
import { jobs, type Job, type NewJob } from "../db/job.schema";

export class JobRepository {
  getByThreadId(threadId: string): Job | undefined {
    const db = getDb();
    const result = db
      .select()
      .from(jobs)
      .where(eq(jobs.threadId, threadId))
      .orderBy(desc(jobs.createdAt))
      .get();
    return result;
  }

  getLatestWithSessionByThreadId(threadId: string): Job | undefined {
    const db = getDb();
    const result = db
      .select()
      .from(jobs)
      .where(and(eq(jobs.threadId, threadId), isNotNull(jobs.sessionId)))
      .orderBy(desc(jobs.createdAt))
      .get();
    return result;
  }

  getActiveByThreadId(threadId: string): Job | undefined {
    const db = getDb();
    const result = db
      .select()
      .from(jobs)
      .where(and(eq(jobs.threadId, threadId), eq(jobs.status, "running")))
      .get();
    return result;
  }

  create(job: NewJob): Job {
    const db = getDb();
    db.insert(jobs).values(job).run();
    return this.getById(job.id)!;
  }

  private getById(id: string): Job | undefined {
    const db = getDb();
    const result = db.select().from(jobs).where(eq(jobs.id, id)).get();
    return result;
  }

  updateStatus(
    id: string,
    status: NonNullable<NewJob["status"]>,
    extras?: Partial<NewJob>,
  ): Job | undefined {
    const db = getDb();
    const updateData: Partial<NewJob> = { status, ...extras };
    db.update(jobs).set(updateData).where(eq(jobs.id, id)).run();
    return this.getById(id);
  }
}

export const jobRepository = new JobRepository();
