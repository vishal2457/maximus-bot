import { Router, Response as ExpressResponse } from "express";
import { ProjectManager } from "../project-manager";
import { DiscordBot } from "../bots/discord-bot";

export function createHealthRouter(
  projectManager: ProjectManager,
  discordBot: DiscordBot | null,
): Router {
  const router = Router();

  router.get("/", (_req, res: ExpressResponse) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      discord: discordBot?.isReady() ? "connected" : "disabled",
      projects: projectManager.getAll().length,
    });
  });

  return router;
}
