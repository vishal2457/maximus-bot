import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  folder: text("folder").notNull(),
  discordCategoryId: text("discord_category_id"),
  developmentChannelId: text("development_channel_id"),
  linearIssuesChannelId: text("linear_issues_channel_id"),
  linearProjectId: text("linear_project_id"),
  linearProjectName: text("linear_project_name"),
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  channelId: text("channel_id").notNull(),
  threadId: text("thread_id").notNull(),
  sessionId: text("session_id"),
  prompt: text("prompt").notNull(),
  authorTag: text("author_tag").notNull(),
  status: text("status").notNull().default("pending"),
  result: text("result"),
  error: text("error"),
  duration: integer("duration"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
