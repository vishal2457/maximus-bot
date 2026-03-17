import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const pendingInteractions = sqliteTable(
  "pending_interactions",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").notNull(),
    threadId: text("thread_id").notNull(),
    sessionId: text("session_id"),
    type: text("type").notNull(),
    payload: text("payload").notNull(),
    status: text("status").notNull().default("pending"),
    reply: text("reply"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  },
  (table) => ({
    jobIdIdx: index("idx_pending_interactions_job_id").on(table.jobId),
    threadIdIdx: index("idx_pending_interactions_thread_id").on(table.threadId),
    statusIdx: index("idx_pending_interactions_status").on(table.status),
    expiresAtIdx: index("idx_pending_interactions_expires_at").on(
      table.expiresAt,
    ),
  }),
);

export type PendingInteraction = typeof pendingInteractions.$inferSelect;
export type NewPendingInteraction = typeof pendingInteractions.$inferInsert;
export type InteractionType = "permission" | "question";
export type InteractionStatus = "pending" | "resolved" | "expired";
