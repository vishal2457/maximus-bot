import fs from "fs";
import path from "path";
import { Project } from "./types";
import { projectRepository } from "./repositories/project-repository";
import { getDb } from "./db";
import { logger } from "./shared/logger";

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
  const legacyDev = p.developmentChannelId || "";
  const legacyLinear = p.linearIssuesChannelId || "";

  return {
    id: p.id,
    name: p.name,
    description: p.description,
    folder: p.folder,
    discordCategoryId: p.discordCategoryId || "",
    developmentChannelId: legacyDev,
    linearIssuesChannelId: legacyLinear,
    slackDevelopmentChannelId: isSlackChannelId(legacyDev) ? legacyDev : "",
    slackLinearIssuesChannelId: isSlackChannelId(legacyLinear)
      ? legacyLinear
      : "",
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
      logger.warn("projects.json not found, creating empty file", {
        filePath: this.filePath,
      });
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2));
    }
    const raw = fs.readFileSync(this.filePath, "utf-8");
    const parsed = JSON.parse(raw) as Array<Partial<Project>>;
    this.projects = parsed.map((project) => ({
      id: project.id || "",
      name: project.name || "",
      description: project.description || "",
      folder: project.folder || "",
      discordCategoryId: project.discordCategoryId || "",
      developmentChannelId: project.developmentChannelId || "",
      linearIssuesChannelId: project.linearIssuesChannelId || "",
      slackDevelopmentChannelId: project.slackDevelopmentChannelId || "",
      slackLinearIssuesChannelId: project.slackLinearIssuesChannelId || "",
      slackTeamId: project.slackTeamId,
      slackCategoryId: project.slackCategoryId,
      linearProjectId: project.linearProjectId,
      linearProjectName: project.linearProjectName,
    }));
    logger.info("Loaded projects from JSON", {
      count: this.projects.length,
      filePath: this.filePath,
    });
  }

  private seedDatabase(): void {
    try {
      getDb();
      const dbProjects = projectRepository.getAll();

      if (dbProjects.length === 0 && this.projects.length > 0) {
        logger.info("Seeding database from JSON", {
          count: this.projects.length,
        });
        projectRepository.seedFromJson(this.projects);
        logger.info("Database seeded successfully");
      } else if (dbProjects.length > 0) {
        logger.info("Database already contains projects", {
          count: dbProjects.length,
        });
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error("Error seeding database", { error: errMsg });
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
      logger.error("Error getting all projects", { error: errMsg });
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
      logger.error("Error getting project by id", { id, error: errMsg });
      return this.projects.find((p) => p.id === id);
    }
  }

  getByDiscordChannelId(channelId: string): Project | undefined {
    try {
      const project = projectRepository.getByDiscordChannelId(channelId);
      if (!project) return undefined;
      return mapDbProject(project);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error("Error getting project by Discord channel id", {
        channelId,
        error: errMsg,
      });
      return this.projects.find(
        (p) =>
          p.developmentChannelId === channelId ||
          p.linearIssuesChannelId === channelId,
      );
    }
  }

  updateDiscordChannelIds(
    projectId: string,
    categoryId: string,
    developmentChannelId: string,
    linearIssuesChannelId: string,
  ): void {
    try {
      projectRepository.updateDiscordChannelIds(
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
        logger.info("Updated Discord channel IDs", {
          projectId,
          categoryId,
          developmentChannelId,
          linearIssuesChannelId,
        });
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error("Error updating Discord channel IDs", {
        projectId,
        error: errMsg,
      });
    }
  }


  add(project: {
    id: string;
    name: string;
    description: string;
    folder: string;
    linearProjectId?: string;
    linearProjectName?: string;
  }): Project {
    const newProject: Project = {
      id: project.id,
      name: project.name,
      description: project.description,
      folder: project.folder,
      discordCategoryId: "",
      developmentChannelId: "",
      linearIssuesChannelId: "",
      slackDevelopmentChannelId: "",
      slackLinearIssuesChannelId: "",
      linearProjectId: project.linearProjectId,
      linearProjectName: project.linearProjectName,
    };

    this.projects.push(newProject);
    this.saveToJson();

    projectRepository.create(project);

    logger.info("Added new project", {
      projectId: project.id,
      projectName: project.name,
    });

    return newProject;
  }

  private saveToJson(): void {
    const projectsToSave = this.projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      folder: p.folder,
      discordCategoryId: p.discordCategoryId || undefined,
      developmentChannelId: p.developmentChannelId || undefined,
      linearIssuesChannelId: p.linearIssuesChannelId || undefined,
      slackDevelopmentChannelId: p.slackDevelopmentChannelId || undefined,
      slackLinearIssuesChannelId: p.slackLinearIssuesChannelId || undefined,
      slackTeamId: p.slackTeamId || undefined,
      slackCategoryId: p.slackCategoryId || undefined,
      linearProjectId: p.linearProjectId || undefined,
      linearProjectName: p.linearProjectName || undefined,
    }));

    fs.writeFileSync(this.filePath, JSON.stringify(projectsToSave, null, 2));
    logger.info("Saved projects to JSON", {
      count: projectsToSave.length,
    });
  }
}

function isSlackChannelId(value: string): boolean {
  return /^[CDG][A-Z0-9]+$/.test(value);
}
