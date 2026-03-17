import { getDb } from "../db";
import { type NewProject, type Project } from "../db/project.schema";
import { projectRepository } from "../repositories/project-repository";
import { logger } from "../shared/logger";

const DEFAULT_PROJECT_NAME = "maximus-bot";

function mapDbProject(p: Project): Project {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    folder: p.folder,
    discordCategoryId: p.discordCategoryId || "",
    linearIssuesChannelId: p.linearIssuesChannelId || "",
    linearProjectId: p?.linearProjectId || "",
    linearProjectName: p?.linearProjectName || "",
  };
}

export class ProjectManager {
  private projects: Project[] = [];
  private projectsById: Map<string, Project> = new Map();
  private projectsByChannelId: Map<string, Project> = new Map();

  constructor() {
    this.ensureDefaultProject();
  }

  private ensureDefaultProject(): void {
    try {
      getDb();
      const dbProjects = projectRepository.getAll();

      if (dbProjects.length === 0) {
        const workspacePath = process.cwd();
        const defaultProject: Project = {
          id: "default",
          name: DEFAULT_PROJECT_NAME,
          description: "Default project",
          folder: workspacePath,
          discordCategoryId: "",
          linearIssuesChannelId: "",
          linearProjectId: "",
          linearProjectName: "",
        };

        projectRepository.create({
          id: defaultProject.id,
          name: defaultProject.name,
          description: defaultProject.description,
          folder: defaultProject.folder,
        });

        logger.info("Created default project", {
          projectId: defaultProject.id,
          name: defaultProject.name,
          folder: defaultProject.folder,
        });

        this.projects = [defaultProject];
      } else {
        this.projects = dbProjects.map(mapDbProject);
        logger.info("Loaded projects from database", {
          count: dbProjects.length,
        });
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error("Error initializing projects", { error: errMsg });
    }

    this.rebuildIndexes();
  }

  private rebuildIndexes(): void {
    this.projectsById.clear();
    this.projectsByChannelId.clear();
    for (const project of this.projects) {
      this.projectsById.set(project.id, project);
      if (project.linearIssuesChannelId) {
        this.projectsByChannelId.set(project.linearIssuesChannelId, project);
      }
    }
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
      return this.projectsById.get(id);
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
      return this.projectsByChannelId.get(channelId);
    }
  }

  getByDiscordCategoryId(categoryId: string): Project | undefined {
    try {
      const project = projectRepository.getByCategoryId(categoryId);
      if (!project) return undefined;
      return mapDbProject(project);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error("Error getting project by Discord category id", {
        categoryId,
        error: errMsg,
      });
      return this.projects.find((p) => p.discordCategoryId === categoryId);
    }
  }

  updateDiscordChannelIds(
    projectId: string,
    categoryId: string,
    linearIssuesChannelId: string,
  ): void {
    try {
      projectRepository.updateDiscordChannelIds(
        projectId,
        categoryId,
        linearIssuesChannelId,
      );
      const project = this.projects.find((p) => p.id === projectId);
      if (project) {
        project.discordCategoryId = categoryId;
        project.linearIssuesChannelId = linearIssuesChannelId;
        logger.info("Updated Discord channel IDs", {
          projectId,
          categoryId,
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
    id: NewProject["id"];
    name: NewProject["name"];
    description: NewProject["description"];
    folder: NewProject["folder"];
    linearProjectId?: NewProject["linearProjectId"];
    linearProjectName?: NewProject["linearProjectName"];
  }): Project {
    const newProject: Project = {
      id: project.id,
      name: project.name,
      description: project.description,
      folder: project.folder,
      discordCategoryId: "",
      linearIssuesChannelId: "",
      linearProjectId: project.linearProjectId || "",
      linearProjectName: project.linearProjectName || "",
    };

    this.projects.push(newProject);
    this.rebuildIndexes();

    projectRepository.create(project);

    logger.info("Added new project", {
      projectId: project.id,
      projectName: project.name,
    });

    return newProject;
  }
}

export const projectManager = new ProjectManager();
