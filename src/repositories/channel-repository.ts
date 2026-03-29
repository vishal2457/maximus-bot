import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { channels, type Channel, type NewChannel } from "../db/channel.schema";

export class ChannelRepository {
  getById(id: string): Channel | undefined {
    return getDb().select().from(channels).where(eq(channels.id, id)).get();
  }

  getByProjectId(projectId: string): Channel[] {
    return getDb()
      .select()
      .from(channels)
      .where(eq(channels.projectId, projectId))
      .all();
  }

  getAll(): Channel[] {
    return getDb().select().from(channels).all();
  }

  create(data: NewChannel): Channel {
    getDb().insert(channels).values(data).run();
    return this.getById(data.id)!;
  }

  update(
    id: string,
    data: Partial<Pick<NewChannel, "name" | "systemPrompt" | "projectId">>,
  ): Channel | undefined {
    const existing = this.getById(id);
    if (!existing) {
      return undefined;
    }

    getDb()
      .update(channels)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(channels.id, id))
      .run();

    return this.getById(id);
  }

  delete(id: string): boolean {
    const existing = this.getById(id);
    if (!existing) {
      return false;
    }

    getDb().delete(channels).where(eq(channels.id, id)).run();
    return true;
  }

  deleteByProjectId(projectId: string): number {
    const items = this.getByProjectId(projectId);
    for (const item of items) {
      this.delete(item.id);
    }
    return items.length;
  }
}

export const channelRepository = new ChannelRepository();
