import { eq, desc, and, isNotNull } from "drizzle-orm";
import { getDb } from "../db";
import { jobs, type Job, type NewJob } from "../db/project.schema";

export class JobRepository {
  getAll(): Job[] {
    const db = getDb();
    return db.select().from(jobs).orderBy(desc(jobs.createdAt)).all();
  }

  getById(id: string): Job | undefined {
    const db = getDb();
    const result = db.select().from(jobs).where(eq(jobs.id, id)).get();
    return result;
  }

  getByProjectId(projectId: string): Job[] {
    const db = getDb();
    return db
      .select()
      .from(jobs)
      .where(eq(jobs.projectId, projectId))
      .orderBy(desc(jobs.createdAt))
      .all();
  }

  getByChannelId(channelId: string): Job[] {
    const db = getDb();
    return db
      .select()
      .from(jobs)
      .where(eq(jobs.channelId, channelId))
      .orderBy(desc(jobs.createdAt))
      .all();
  }

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

  getActiveByChannelId(channelId: string): Job | undefined {
    const db = getDb();
    const result = db
      .select()
      .from(jobs)
      .where(and(eq(jobs.channelId, channelId), eq(jobs.status, "running")))
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

  update(id: string, data: Partial<NewJob>): Job | undefined {
    const db = getDb();
    db.update(jobs).set(data).where(eq(jobs.id, id)).run();
    return this.getById(id);
  }

  updateStatus(
    id: string,
    status: string,
    extras?: Partial<NewJob>,
  ): Job | undefined {
    const db = getDb();
    const updateData: Partial<NewJob> = { status, ...extras };
    db.update(jobs).set(updateData).where(eq(jobs.id, id)).run();
    return this.getById(id);
  }

  delete(id: string): void {
    const db = getDb();
    db.delete(jobs).where(eq(jobs.id, id)).run();
  }

  deleteOld(keepCount: number = 100): number {
    const db = getDb();
    const allJobs = db.select().from(jobs).orderBy(desc(jobs.createdAt)).all();

    if (allJobs.length <= keepCount) {
      return 0;
    }

    const toDelete = allJobs.slice(keepCount);
    let deleted = 0;

    for (const job of toDelete) {
      db.delete(jobs).where(eq(jobs.id, job.id)).run();
      deleted += 1;
    }

    return deleted;
  }
}

export const jobRepository = new JobRepository();
