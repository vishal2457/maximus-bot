import "dotenv/config";
import { ProjectManager } from "./project-manager";
import { DiscordBot } from "./bots/discord-bot";
import { createServer } from "./server";
import { shutdownOpenCodeRunner } from "./open-code-runner";
import { logger } from "./shared/logger";

const PORT = parseInt(process.env.PORT || "3000", 10);

async function main(): Promise<void> {
  const enableDiscord =
    process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
  if (!enableDiscord) {
    logger.error("No bot configured. Please configure at least one of:");
    logger.error("Discord: DISCORD_BOT_TOKEN, DISCORD_GUILD_ID");
    logger.error("Copy .env.example to .env and fill in the values.");
    process.exit(1);
  }

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
  }

  logger.info("Starting OpenCode Bridge");

  // ── 1. Load Projects ──────────────────────────────────────────────────────
  const projectManager = new ProjectManager();

  // ── 2. Start Bots ──────────────────────────────────────────────────────────
  const discordBot = enableDiscord ? new DiscordBot(projectManager) : null;

  if (discordBot) {
    await discordBot.start();
    logger.info("Discord bot started successfully");
  }

  // ── 3. Start Express Server ───────────────────────────────────────────────
  const app = createServer(projectManager, discordBot);
  app.listen(PORT, () => {
    logger.info("HTTP server listening", {
      url: `http://localhost:${PORT}`,
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
  });

  // ── 4. Graceful Shutdown ──────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info("Received shutdown signal", { signal });

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
