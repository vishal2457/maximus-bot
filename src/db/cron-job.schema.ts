import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const cronJobs = sqliteTable("cron_jobs", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  title: text("title").notNull(),
  cronExpression: text("cron_expression").notNull(),
  prompt: text("prompt").notNull(),
  authorTag: text("author_tag").notNull(),
  channelId: text("channel_id"),
  threadId: text("thread_id"),
  sdkType: text("sdk_type").notNull().default("opencode"),
  isActive: integer("is_active").notNull().default(1),
  lastRunAt: integer("last_run_at", { mode: "timestamp" }),
  nextRunAt: integer("next_run_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type CronJob = typeof cronJobs.$inferSelect;
export type NewCronJob = typeof cronJobs.$inferInsert;
