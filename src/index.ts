import "dotenv/config";
import { ProjectManager } from "./project-manager";
import { DiscordBot } from "./bots/discord-bot";
import { createServer } from "./server";
import { shutdownOpenCodeRunner } from "./open-code-runner";
import { logger } from "./shared/logger";
import { jobProcessor } from "./job-processor";

const PORT = parseInt(process.env.PORT || "0", 10);

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
        "GET /projects",
        "POST /projects/reload",
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
  logger.info("Registered route", { method: "GET", path: "/projects" });
  logger.info("Registered route", {
    method: "POST",
    path: "/projects/reload",
  });
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
