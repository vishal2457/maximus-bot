import { Router, Response as ExpressResponse } from "express";
import { ProjectManager } from "../services/project-manager";
import { opencodeRuntimeManager } from "../services/opencode-runtime-manager";
import { success } from "../shared/api-response";

export function createHealthRouter(projectManager: ProjectManager): Router {
  const router = Router();

  router.get("/", (_req, res: ExpressResponse) => {
    success(
      res,
      {
        status: "ok",
        uptime: process.uptime(),
        opencodeRuntimes: opencodeRuntimeManager.getActiveProjectIds().length,
        projects: projectManager.getAll().length,
      },
      "Health check successful",
    );
  });

  return router;
}
