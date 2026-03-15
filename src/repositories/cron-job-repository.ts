import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { cronJobs, type CronJob, type NewCronJob } from "../db/cron-job.schema";

export class CronJobRepository {
  getById(id: string): CronJob | undefined {
    const db = getDb();
    return db.select().from(cronJobs).where(eq(cronJobs.id, id)).get();
  }

  getByProjectId(projectId: string): CronJob[] {
    const db = getDb();
    return db
      .select()
      .from(cronJobs)
      .where(eq(cronJobs.projectId, projectId))
      .all();
  }

  getActive(): CronJob[] {
    const db = getDb();
    return db.select().from(cronJobs).where(eq(cronJobs.isActive, 1)).all();
  }

  getDueForExecution(): CronJob[] {
    const db = getDb();
    const now = new Date();
    return db
      .select()
      .from(cronJobs)
      .where(and(eq(cronJobs.isActive, 1)))
      .all()
      .filter((job) => job.nextRunAt && job.nextRunAt <= now);
  }

  create(cronJob: NewCronJob): CronJob {
    const db = getDb();
    const now = new Date();
    db.insert(cronJobs)
      .values({
        ...cronJob,
        sdkType: cronJob.sdkType || "opencode",
        isActive: cronJob.isActive ?? 1,
        createdAt: cronJob.createdAt || now,
        updatedAt: now,
      })
      .run();
    return this.getById(cronJob.id)!;
  }

  update(id: string, data: Partial<NewCronJob>): CronJob | undefined {
    const db = getDb();
    db.update(cronJobs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(cronJobs.id, id))
      .run();
    return this.getById(id);
  }

  delete(id: string): void {
    const db = getDb();
    db.delete(cronJobs).where(eq(cronJobs.id, id)).run();
  }

  updateNextRun(id: string, nextRunAt: Date, lastRunAt: Date): void {
    const db = getDb();
    db.update(cronJobs)
      .set({ nextRunAt, lastRunAt, updatedAt: new Date() })
      .where(eq(cronJobs.id, id))
      .run();
  }
}

export const cronJobRepository = new CronJobRepository();
