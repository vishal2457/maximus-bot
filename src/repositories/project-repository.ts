import { eq, or } from "drizzle-orm";
import { getDb } from "../db";
import { projects, type Project, type NewProject } from "../db/project.schema";

export class ProjectRepository {
  getAll(): Project[] {
    const db = getDb();
    return db.select().from(projects).all();
  }

  getById(id: string): Project | undefined {
    const db = getDb();
    const result = db.select().from(projects).where(eq(projects.id, id)).get();
    return result;
  }

  getByChannelId(channelId: string): Project | undefined {
    const db = getDb();
    const result = db
      .select()
      .from(projects)
      .where(
        or(
          eq(projects.developmentChannelId, channelId),
          eq(projects.linearIssuesChannelId, channelId),
        ),
      )
      .get();
    return result;
  }

  getByCategoryId(categoryId: string): Project | undefined {
    const db = getDb();
    const result = db
      .select()
      .from(projects)
      .where(eq(projects.discordCategoryId, categoryId))
      .get();
    return result;
  }

  updateChannelIds(
    id: string,
    categoryId: string,
    developmentChannelId: string,
    linearIssuesChannelId: string,
  ): void {
    const db = getDb();
    db.update(projects)
      .set({
        discordCategoryId: categoryId,
        developmentChannelId,
        linearIssuesChannelId,
      })
      .where(eq(projects.id, id))
      .run();
  }

  seedFromJson(
    jsonProjects: Array<{
      id: string;
      name: string;
      description: string;
      folder: string;
      discordCategoryId?: string;
      developmentChannelId?: string;
      linearIssuesChannelId?: string;
      linearProjectId?: string;
      linearProjectName?: string;
    }>,
  ): void {
    const db = getDb();
    const existing = this.getAll();

    if (existing.length > 0) {
      return;
    }

    for (const project of jsonProjects) {
      db.insert(projects)
        .values({
          id: project.id,
          name: project.name,
          description: project.description,
          folder: project.folder,
          discordCategoryId: project.discordCategoryId || null,
          developmentChannelId: project.developmentChannelId || null,
          linearIssuesChannelId: project.linearIssuesChannelId || null,
          linearProjectId: project.linearProjectId || null,
          linearProjectName: project.linearProjectName || null,
        })
        .run();
    }
  }
}

export const projectRepository = new ProjectRepository();
