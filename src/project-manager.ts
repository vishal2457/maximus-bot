import fs from "fs";
import path from "path";
import { Project } from "./types";

const PROJECTS_FILE = process.env.PROJECTS_FILE || "./projects.json";

export class ProjectManager {
  private projects: Project[] = [];
  private filePath: string;

  constructor() {
    this.filePath = path.resolve(process.cwd(), PROJECTS_FILE);
    this.load();
  }

  private load(): void {
    if (!fs.existsSync(this.filePath)) {
      console.warn(
        `[ProjectManager] projects.json not found at ${this.filePath}, creating empty file.`,
      );
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2));
    }
    const raw = fs.readFileSync(this.filePath, "utf-8");
    this.projects = JSON.parse(raw) as Project[];
    console.log(`[ProjectManager] Loaded ${this.projects.length} project(s).`);
  }

  reload(): void {
    this.load();
  }

  save(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.projects, null, 2));
  }

  getAll(): Project[] {
    return this.projects;
  }

  getById(id: string): Project | undefined {
    return this.projects.find((p) => p.id === id);
  }

  getByChannelId(channelId: string): Project | undefined {
    return this.projects.find((p) => p.discordChannelId === channelId);
  }

  getByChannelName(name: string): Project | undefined {
    return this.projects.find((p) => p.discordChannelName === name);
  }

  updateChannelId(projectId: string, channelId: string): void {
    const project = this.projects.find((p) => p.id === projectId);
    if (project) {
      project.discordChannelId = channelId;
      this.save();
      console.log(
        `[ProjectManager] Updated channelId for project "${projectId}" → ${channelId}`,
      );
    }
  }
}
