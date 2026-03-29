import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const channels = sqliteTable(
  "channels",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull().default("agent"),
    systemPrompt: text("system_prompt"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    projectIdIdx: index("idx_channels_project_id").on(table.projectId),
  }),
);

export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
