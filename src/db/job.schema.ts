import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    channelId: text("channel_id").notNull(),
    threadId: text("thread_id").notNull(),
    sessionId: text("session_id"),
    prompt: text("prompt").notNull(),
    systemPrompt: text("system_prompt"),
    authorTag: text("author_tag").notNull(),
    status: text("status").notNull().default("pending"),
    result: text("result"),
    error: text("error"),
    duration: integer("duration"),
    platform: text("platform").notNull().default("discord"),
    platformThreadId: text("platform_thread_id"),
    sdkType: text("sdk_type").notNull().default("opencode"),
    workerId: text("worker_id"),
    retryCount: integer("retry_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    startedAt: integer("started_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),
  },
  (table) => ({
    statusIdx: index("idx_jobs_status").on(table.status),
    threadIdIdx: index("idx_jobs_thread_id").on(table.threadId),
    createdAtIdx: index("idx_jobs_created_at").on(table.createdAt),
    statusCreatedIdx: index("idx_jobs_status_created").on(
      table.status,
      table.createdAt,
    ),
  }),
);

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type JobPlatform = "discord" | "slack";
export type SdkType = "opencode" | "codex";
export type JobStatus = "pending" | "running" | "completed" | "failed";
