import {
  Router,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import { ProjectManager } from "../project-manager";
import { DiscordBot } from "../bots/discord-bot";
import { cronJobRepository } from "../repositories/cron-job-repository";
import { getNextRunTime, formatExecutionTime } from "../workers/cron-scheduler";
import { logger } from "../shared/logger";
import { getActiveAgent } from "../agent-manager";

const GUILD_ID = process.env.DISCORD_GUILD_ID || "";
const DISCORD_TOKEN =
  process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || "";
const DISCORD_API_BASE = "https://discord.com/api/v10";

export function createCronJobsRouter(
  projectManager: ProjectManager,
  discordBot: DiscordBot | null,
): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    const jobs = cronJobRepository.getActive();
    res.json(
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
      res.status(400).json({
        error: "projectId, cronExpression, title, and prompt are required",
      });
      return;
    }

    if (!isValidCronExpression(cronExpression)) {
      res.status(400).json({
        error:
          "Invalid cron expression. Use 5-field format (minute hour day-of-month month day-of-week)",
      });
      return;
    }

    const project = projectManager.getById(projectId);
    if (!project) {
      res.status(404).json({ error: `Project "${projectId}" not found` });
      return;
    }

    if (!discordBot?.isReady()) {
      res.status(503).json({ error: "Discord bot is not available" });
      return;
    }

    try {
      const jobId = `cron_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      const executionTime = formatExecutionTime(cronExpression);
      const shortTitle = title.length > 20 ? title.slice(0, 17) + "..." : title;
      const channelName = `cron - ${shortTitle} ${executionTime}`
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 100);

      const categoryId = project.discordCategoryId;
      let channelId: string | null = null;

      if (categoryId) {
        const response = await fetch(
          `${DISCORD_API_BASE}/guilds/${GUILD_ID}/channels`,
          {
            method: "POST",
            headers: {
              Authorization: `Bot ${DISCORD_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: channelName,
              type: 0,
              parent_id: categoryId,
              topic: `Cron job: ${title}\nSchedule: ${cronExpression}`,
            }),
          },
        );

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Discord API error: ${response.status} ${errText}`);
        }

        const createdChannel = (await response.json()) as { id: string };
        channelId = createdChannel.id;

        logger.info("Created cron job channel via API", {
          jobId,
          channelId,
          title,
        });
      }

      const nextRun = getNextRunTime(cronExpression);
      const activeSdkType = sdkType || getActiveAgent();

      cronJobRepository.create({
        id: jobId,
        projectId: project.id,
        title,
        cronExpression,
        prompt,
        authorTag: "API",
        channelId,
        threadId: channelId,
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
        channelId,
      });

      res.status(201).json({
        id: jobId,
        projectId: project.id,
        title,
        cronExpression,
        channelId,
        nextRunAt: nextRun.toISOString(),
        sdkType: activeSdkType,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("Failed to create cron job via API", { error: msg });
      res.status(500).json({ error: msg });
    }
  });

  router.delete("/:id", (req: ExpressRequest, res: ExpressResponse) => {
    const { id } = req.params;
    const job = cronJobRepository.getById(id);

    if (!job) {
      res.status(404).json({ error: `Cron job "${id}" not found` });
      return;
    }

    cronJobRepository.delete(id);
    logger.info("Cron job deleted via API", { jobId: id });

    res.json({ ok: true });
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
