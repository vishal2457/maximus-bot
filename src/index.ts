import "dotenv/config";
import { ProjectManager } from "./services/project-manager";
import { DiscordBot } from "./bots/discord-bot";
import { createServer } from "./server";
import { shutdownOpenCodeRunner } from "./services/open-code-runner";
import { logger } from "./shared/logger";
import { jobProcessor } from "./services/job-processor";
import { jobQueueRepository } from "./repositories/job-queue-repository";

const PORT = parseInt(process.env.PORT || "0", 10);

const RUNNING_JOBS_CHECK_INTERVAL_MS = 5 * 60 * 1000;

async function startRunningJobsScheduler(): Promise<void> {
  const checkRunningJobs = (): void => {
    const runningJobs = jobQueueRepository.getRunningJobs();
    logger.info("Running jobs check", {
      count: runningJobs.length,
      jobs: runningJobs.map((j) => ({
        id: j.id,
        projectId: j.projectId,
        status: j.status,
        prompt: j.prompt?.slice(0, 50),
        workerId: j.workerId,
      })),
    });
  };

  checkRunningJobs();
  setInterval(checkRunningJobs, RUNNING_JOBS_CHECK_INTERVAL_MS);
  logger.info("Running jobs scheduler started", {
    intervalMs: RUNNING_JOBS_CHECK_INTERVAL_MS,
  });
}

async function main(): Promise<void> {
  logger.info("Starting Maximus Bot");

  const enableDiscord =
    process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;

  const projectManager = new ProjectManager();

  let discordBot: DiscordBot | null = null;

  if (enableDiscord) {
    const missing: string[] = [];
    if (!process.env.DISCORD_BOT_TOKEN && !process.env.DISCORD_TOKEN) {
      missing.push("DISCORD_BOT_TOKEN (or DISCORD_TOKEN)");
    }
    if (!process.env.DISCORD_GUILD_ID) {
      missing.push("DISCORD_GUILD_ID");
    }
    if (missing.length > 0) {
      logger.error("Missing required Discord environment variables", {
        missing,
      });
      process.exit(1);
    }

    discordBot = new DiscordBot(projectManager);
    await discordBot.start();
    logger.info("Discord bot started successfully");

    jobProcessor.setPermissionHandler(discordBot);
  }

  await jobProcessor.start();

  await startRunningJobsScheduler();

  const app = createServer(projectManager, discordBot);
  const server = app.listen(PORT || undefined, () => {
    const address = server.address();
    const actualPort =
      typeof address === "object" && address ? address.port : PORT;
    logger.info("HTTP server listening", {
      url: `http://localhost:${actualPort}`,
      port: actualPort,
      routes: [
        "GET /health",
        ...(discordBot ? ["POST /api/webhooks/discord"] : []),
        "GET /api/project",
        "POST /sync",
        'POST /run/:projectId {"prompt":"..."}',
        "GET /logs/:type",
      ],
    });
  });

  logger.info("Registered route", { method: "GET", path: "/health" });
  if (discordBot) {
    logger.info("Registered route", {
      method: "POST",
      path: "/api/webhooks/discord",
    });
  }
  logger.info("Registered route", { method: "GET", path: "/api/project" });
  logger.info("Registered route", { method: "POST", path: "/sync" });
  logger.info("Registered route", {
    method: "POST",
    path: "/run/:projectId",
    body: { prompt: "..." },
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info("Received shutdown signal", { signal });

    await jobProcessor.stop();

    if (discordBot) {
      await discordBot.shutdown();
    }

    await shutdownOpenCodeRunner();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception", { error: err });
  });
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", { reason });
  });
}

main().catch((err) => {
  logger.error("Fatal startup error", { error: err });
  process.exit(1);
});
