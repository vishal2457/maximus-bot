import {
  Router,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import { ProjectManager } from "../project-manager";
import { DiscordBot } from "../bots/discord-bot";
import { success, error, StatusCodes } from "../shared/api-response";

export function createProjectsRouter(
  projectManager: ProjectManager,
  discordBot: DiscordBot | null,
): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    success(res, projectManager.getAll(), "Projects fetched successfully");
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
      error(
        res,
        "name, description, and folder are required",
        StatusCodes.BAD_REQUEST,
      );
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

      success(
        res,
        newProject,
        "Project created successfully",
        StatusCodes.CREATED,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  });

  return router;
}
