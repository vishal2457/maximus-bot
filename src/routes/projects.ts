import {
  Router,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import { ProjectManager } from "../project-manager";
import { DiscordBot } from "../bots/discord-bot";

export function createProjectsRouter(
  projectManager: ProjectManager,
  discordBot: DiscordBot | null,
): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(projectManager.getAll());
  });

  router.post("/", async (req: ExpressRequest, res: ExpressResponse) => {
    const { name, description, folder, linearProjectId, linearProjectName } =
      req.body as {
        name?: string;
        description?: string;
        folder?: string;
        linearProjectId?: string;
        linearProjectName?: string;
      };

    if (!name || !description || !folder) {
      res
        .status(400)
        .json({ error: "name, description, and folder are required" });
      return;
    }

    const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    try {
      const newProject = projectManager.add({
        id,
        name,
        description,
        folder,
        linearProjectId,
        linearProjectName,
      });

      if (discordBot) {
        await discordBot.syncChannels();
      }

      res.status(201).json(newProject);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
