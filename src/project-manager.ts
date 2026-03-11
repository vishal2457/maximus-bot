import fs from "fs";
import path from "path";
import { Project } from "./types";
import { projectRepository } from "./repositories/project-repository";
import { getDb } from "./db";

const PROJECTS_FILE = process.env.PROJECTS_FILE || "./projects.json";

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
    } catch (error) {
      console.error(`[ProjectManager] Error seeding database:`, error);
    }
  }

  reload(): void {
    this.loadFromJson();
    this.seedDatabase();
  }

  save(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.projects, null, 2));
  }

  getAll(): Project[] {
    try {
      const dbProjects = projectRepository.getAll();
      return dbProjects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        folder: p.folder,
        discordCategoryId: p.discordCategoryId || "",
        developmentChannelId: p.developmentChannelId || "",
        linearIssuesChannelId: p.linearIssuesChannelId || "",
        linearProjectId: p.linearProjectId || undefined,
        linearProjectName: p.linearProjectName || undefined,
      }));
    } catch (error) {
      console.error(`[ProjectManager] Error getting all projects:`, error);
      return this.projects;
    }
  }

  getById(id: string): Project | undefined {
    try {
      const project = projectRepository.getById(id);
      if (!project) return undefined;
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        folder: project.folder,
        discordCategoryId: project.discordCategoryId || "",
        developmentChannelId: project.developmentChannelId || "",
        linearIssuesChannelId: project.linearIssuesChannelId || "",
        linearProjectId: project.linearProjectId || undefined,
        linearProjectName: project.linearProjectName || undefined,
      };
    } catch (error) {
      console.error(`[ProjectManager] Error getting project by id:`, error);
      return this.projects.find((p) => p.id === id);
    }
  }

  getByChannelId(channelId: string): Project | undefined {
    try {
      const project = projectRepository.getByChannelId(channelId);
      if (!project) return undefined;
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        folder: project.folder,
        discordCategoryId: project.discordCategoryId || "",
        developmentChannelId: project.developmentChannelId || "",
        linearIssuesChannelId: project.linearIssuesChannelId || "",
        linearProjectId: project.linearProjectId || undefined,
        linearProjectName: project.linearProjectName || undefined,
      };
    } catch (error) {
      console.error(
        `[ProjectManager] Error getting project by channel id:`,
        error,
      );
      return this.projects.find(
        (p) =>
          p.developmentChannelId === channelId ||
          p.linearIssuesChannelId === channelId,
      );
    }
  }

  getByCategoryId(categoryId: string): Project | undefined {
    try {
      const project = projectRepository.getByCategoryId(categoryId);
      if (!project) return undefined;
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        folder: project.folder,
        discordCategoryId: project.discordCategoryId || "",
        developmentChannelId: project.developmentChannelId || "",
        linearIssuesChannelId: project.linearIssuesChannelId || "",
        linearProjectId: project.linearProjectId || undefined,
        linearProjectName: project.linearProjectName || undefined,
      };
    } catch (error) {
      console.error(
        `[ProjectManager] Error getting project by category id:`,
        error,
      );
      return this.projects.find((p) => p.discordCategoryId === categoryId);
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
    } catch (error) {
      console.error(`[ProjectManager] Error updating channel ids:`, error);
    }
  }
}
