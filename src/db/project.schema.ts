import { sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
