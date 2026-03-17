import { eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  channelConfigs,
  type ChannelConfig,
  type NewChannelConfig,
} from "../db/channel-config.schema";

export class ChannelConfigRepository {
  getById(id: string): ChannelConfig | undefined {
    return getDb()
      .select()
      .from(channelConfigs)
      .where(eq(channelConfigs.id, id))
      .get();
  }

  getByChannelId(channelId: string): ChannelConfig | undefined {
    return getDb()
      .select()
      .from(channelConfigs)
      .where(eq(channelConfigs.channelId, channelId))
      .get();
  }

  getByProjectId(projectId: string): ChannelConfig[] {
    return getDb()
      .select()
      .from(channelConfigs)
      .where(eq(channelConfigs.projectId, projectId))
      .all();
  }

  getAll(): ChannelConfig[] {
    return getDb().select().from(channelConfigs).all();
  }

  create(config: NewChannelConfig): ChannelConfig {
    getDb().insert(channelConfigs).values(config).run();
    return this.getById(config.id)!;
  }

  update(
    id: string,
    data: Partial<
      Pick<
        NewChannelConfig,
        "name" | "systemPrompt" | "channelId" | "projectId"
      >
    >,
  ): ChannelConfig | undefined {
    const existing = this.getById(id);
    if (!existing) {
      return undefined;
    }

    getDb()
      .update(channelConfigs)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(channelConfigs.id, id))
      .run();

    return this.getById(id);
  }

  delete(id: string): boolean {
    const existing = this.getById(id);
    if (!existing) {
      return false;
    }

    getDb().delete(channelConfigs).where(eq(channelConfigs.id, id)).run();
    return true;
  }

  deleteByProjectId(projectId: string): number {
    const configs = this.getByProjectId(projectId);
    for (const config of configs) {
      this.delete(config.id);
    }
    return configs.length;
  }
}

export const channelConfigRepository = new ChannelConfigRepository();
