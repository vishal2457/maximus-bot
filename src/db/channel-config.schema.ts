import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const channelConfigs = sqliteTable(
  "channel_configs",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id").notNull(),
    projectId: text("project_id").notNull(),
    name: text("name").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    channelIdIdx: index("idx_channel_configs_channel_id").on(table.channelId),
    projectIdIdx: index("idx_channel_configs_project_id").on(table.projectId),
  }),
);

export type ChannelConfig = typeof channelConfigs.$inferSelect;
export type NewChannelConfig = typeof channelConfigs.$inferInsert;
