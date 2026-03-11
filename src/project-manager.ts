import fs from "fs";
import path from "path";
import { Project } from "./types";
import { projectRepository } from "./repositories/project-repository";
import { getDb } from "./db";

const PROJECTS_FILE = process.env.PROJECTS_FILE || "./projects.json";

type DbProject = {
  id: string;
  name: string;
  description: string;
  folder: string;
  discordCategoryId: string | null;
  developmentChannelId: string | null;
  linearIssuesChannelId: string | null;
  linearProjectId: string | null;
  linearProjectName: string | null;
};

function mapDbProject(p: DbProject): Project {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    folder: p.folder,
    discordCategoryId: p.discordCategoryId || "",
    developmentChannelId: p.developmentChannelId || "",
    linearIssuesChannelId: p.linearIssuesChannelId || "",
    linearProjectId: p.linearProjectId || undefined,
    linearProjectName: p.linearProjectName || undefined,
  };
}

export class ProjectManager {
  private projects: Project[] = [];
  private filePath: string;

  constructor() {
    this.filePath = path.resolve(process.cwd(), PROJECTS_FILE);
    this.loadFromJson();
    this.seedDatabase();
  }

  private loadFromJson(): void {
    if (!fs.existsSync(this.filePath)) {
      console.warn(
        `[ProjectManager] projects.json not found at ${this.filePath}, creating empty file.`,
      );
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2));
    }
    const raw = fs.readFileSync(this.filePath, "utf-8");
    this.projects = JSON.parse(raw) as Project[];
    console.log(
      `[ProjectManager] Loaded ${this.projects.length} project(s) from JSON.`,
    );
  }

  private seedDatabase(): void {
    try {
      getDb();
      const dbProjects = projectRepository.getAll();

      if (dbProjects.length === 0 && this.projects.length > 0) {
        console.log(
          `[ProjectManager] Seeding database with ${this.projects.length} project(s) from JSON...`,
        );
        projectRepository.seedFromJson(this.projects);
        console.log(`[ProjectManager] Database seeded successfully.`);
      } else if (dbProjects.length > 0) {
        console.log(
          `[ProjectManager] Database already contains ${dbProjects.length} project(s).`,
        );
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[ProjectManager] Error seeding database: ${errMsg}`);
    }
  }

  reload(): void {
    this.loadFromJson();
    this.seedDatabase();
  }

  getAll(): Project[] {
    try {
      const dbProjects = projectRepository.getAll();
      return dbProjects.map(mapDbProject);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[ProjectManager] Error getting all projects: ${errMsg}`);
      return this.projects;
    }
  }

  getById(id: string): Project | undefined {
    try {
      const project = projectRepository.getById(id);
      if (!project) return undefined;
      return mapDbProject(project);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[ProjectManager] Error getting project by id: ${errMsg}`);
      return this.projects.find((p) => p.id === id);
    }
  }

  getByChannelId(channelId: string): Project | undefined {
    try {
      const project = projectRepository.getByChannelId(channelId);
      if (!project) return undefined;
      return mapDbProject(project);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(
        `[ProjectManager] Error getting project by channel id: ${errMsg}`,
      );
      return this.projects.find(
        (p) =>
          p.developmentChannelId === channelId ||
          p.linearIssuesChannelId === channelId,
      );
    }
  }

  updateChannelIds(
    projectId: string,
    categoryId: string,
    developmentChannelId: string,
    linearIssuesChannelId: string,
  ): void {
    try {
      projectRepository.updateChannelIds(
        projectId,
        categoryId,
        developmentChannelId,
        linearIssuesChannelId,
      );
      const project = this.projects.find((p) => p.id === projectId);
      if (project) {
        project.discordCategoryId = categoryId;
        project.developmentChannelId = developmentChannelId;
        project.linearIssuesChannelId = linearIssuesChannelId;
        console.log(
          `[ProjectManager] Updated channels for project "${projectId}" → cat: ${categoryId}, dev: ${developmentChannelId}, linear: ${linearIssuesChannelId}`,
        );
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[ProjectManager] Error updating channel ids: ${errMsg}`);
    }
  }
}
