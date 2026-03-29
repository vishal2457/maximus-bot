import {
  Router,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import { ProjectManager } from "../services/project-manager";
import { chatService } from "../services/chat-service";
import { logger } from "../shared/logger";
import { success, error, StatusCodes } from "../shared/api-response";

export function createRunRouter(projectManager: ProjectManager): Router {
  const router = Router();

  router.post(
    "/:projectId",
    async (req: ExpressRequest, res: ExpressResponse) => {
      const { projectId } = req.params;
      const { prompt, sessionId } = req.body as {
        prompt?: string;
        sessionId?: string;
      };

      if (!prompt) {
        error(res, "prompt is required", StatusCodes.BAD_REQUEST);
        return;
      }

      const project = projectManager.getById(projectId);
      if (!project) {
        error(res, `Project "${projectId}" not found`, StatusCodes.NOT_FOUND);
        return;
      }

      logger.info("Run triggered via HTTP", { projectId });

      try {
        const result = await chatService.sendMessage(
          projectId,
          prompt,
          sessionId,
        );
        success(res, result, "Run completed successfully");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("Run failed", { projectId, error: msg });
        error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
      }
    },
  );

  return router;
}
