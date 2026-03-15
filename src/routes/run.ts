import {
  Router,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import { ProjectManager } from "../project-manager";
import { DiscordBot } from "../bots/discord-bot";
import { runOpenCode, formatResultForDiscord } from "../open-code-runner";
import { logger } from "../shared/logger";
import { success, error, StatusCodes } from "../shared/api-response";

export function createRunRouter(
  projectManager: ProjectManager,
  discordBot: DiscordBot | null,
): Router {
  const router = Router();

  router.post(
    "/:projectId",
    async (req: ExpressRequest, res: ExpressResponse) => {
      const { projectId } = req.params;
      const { prompt } = req.body as { prompt?: string };

      if (!prompt) {
        error(res, "prompt is required", StatusCodes.BAD_REQUEST);
        return;
      }

      const project = projectManager.getById(projectId);
      if (!project) {
        error(res, `Project "${projectId}" not found`, StatusCodes.NOT_FOUND);
        return;
      }

      logger.info("OpenCode run triggered via HTTP", { projectId });

      const result = await runOpenCode(prompt, project.folder);

      const msg = formatResultForDiscord(result, project.name);

      if (discordBot?.isReady() && project.developmentChannelId) {
        try {
          await discordBot.postToChannel(
            project.developmentChannelId,
            `📡 *Triggered via HTTP*\n> ${prompt.slice(0, 200)}\n\n${msg}`,
          );
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : String(e);
          logger.warn("Could not post run result to Discord", {
            projectId,
            error: errMsg,
          });
        }
      }

      success(
        res,
        {
          projectId,
          success: result.success,
          output: result.output,
          error: result.error,
          exitCode: result.exitCode,
          duration: result.duration,
        },
        "Run completed successfully",
      );
    },
  );

  return router;
}
