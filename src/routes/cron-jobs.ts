import {
  Router,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import { ProjectManager } from "../services/project-manager";
import { cronJobRepository } from "../repositories/cron-job-repository";
import {
  getNextRunTime,
  formatExecutionTime,
} from "../services/cron-scheduler";
import { logger } from "../shared/logger";
import { getActiveAgent } from "../agent-manager";
import { success, error, StatusCodes } from "../shared/api-response";

export function createCronJobsRouter(projectManager: ProjectManager): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    const jobs = cronJobRepository.getActive();
    success(
      res,
      jobs.map((job) => ({
        id: job.id,
        projectId: job.projectId,
        title: job.title,
        cronExpression: job.cronExpression,
        channelId: job.channelId,
        isActive: job.isActive === 1,
        nextRunAt: job.nextRunAt?.toISOString() || null,
        lastRunAt: job.lastRunAt?.toISOString() || null,
        sdkType: job.sdkType,
      })),
      "Cron jobs fetched successfully",
    );
  });

  router.post("/", async (req: ExpressRequest, res: ExpressResponse) => {
    const { projectId, cronExpression, title, prompt, sdkType } = req.body as {
      projectId?: string;
      cronExpression?: string;
      title?: string;
      prompt?: string;
      sdkType?: "opencode" | "codex";
    };

    if (!projectId || !cronExpression || !title || !prompt) {
      error(
        res,
        "projectId, cronExpression, title, and prompt are required",
        StatusCodes.BAD_REQUEST,
      );
      return;
    }

    if (!isValidCronExpression(cronExpression)) {
      error(
        res,
        "Invalid cron expression. Use 5-field format (minute hour day-of-month month day-of-week)",
        StatusCodes.BAD_REQUEST,
      );
      return;
    }

    const project = projectManager.getById(projectId);
    if (!project) {
      error(res, `Project "${projectId}" not found`, StatusCodes.NOT_FOUND);
      return;
    }

    try {
      const jobId = `cron_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      const nextRun = getNextRunTime(cronExpression);
      const activeSdkType = sdkType || getActiveAgent();

      cronJobRepository.create({
        id: jobId,
        projectId: project.id,
        title,
        cronExpression,
        prompt,
        authorTag: "API",
        channelId: null,
        threadId: null,
        sdkType: activeSdkType,
        isActive: 1,
        nextRunAt: nextRun,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      logger.info("Cron job created via API", {
        jobId,
        projectId: project.id,
        title,
      });

      res.status(StatusCodes.CREATED);
      success(
        res,
        {
          id: jobId,
          projectId: project.id,
          title,
          cronExpression,
          nextRunAt: nextRun.toISOString(),
          sdkType: activeSdkType,
        },
        "Cron job created successfully",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Failed to create cron job via API", { error: msg });
      error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  });

  router.delete("/:id", (req: ExpressRequest, res: ExpressResponse) => {
    const { id } = req.params;
    const job = cronJobRepository.getById(id);

    if (!job) {
      error(res, `Cron job "${id}" not found`, StatusCodes.NOT_FOUND);
      return;
    }

    cronJobRepository.delete(id);
    logger.info("Cron job deleted via API", { jobId: id });

    success(res, { ok: true }, "Cron job deleted successfully");
  });

  return router;
}

function isValidCronExpression(expression: string): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return false;
  }
  const cronFieldRegex = /^(\*|(\d+(-\d+)?)(,\d+(-\d+)?)*(\/\d+)?|\*\/\d+)$/;
  return parts.every((part) => cronFieldRegex.test(part));
}
