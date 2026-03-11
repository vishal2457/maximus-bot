import "dotenv/config";
import { ProjectManager } from "./project-manager";
import { DiscordBot } from "./bots/discord-bot";
import { createServer } from "./server";
import { shutdownOpenCodeRunner } from "./open-code-runner";

const PORT = parseInt(process.env.PORT || "3000", 10);

async function main(): Promise<void> {
  const enableDiscord =
    process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
  if (!enableDiscord) {
    console.error("No bot configured. Please configure at least one of:");
    console.error("  - Discord: DISCORD_BOT_TOKEN, DISCORD_GUILD_ID");
    console.error(`   Copy .env.example to .env and fill in the values.`);
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
      console.error(
        `Missing required Discord environment variables: ${missing.join(", ")}`,
      );
      process.exit(1);
    }
  }

  console.log("Starting OpenCode Bridge...");

  // ── 1. Load Projects ──────────────────────────────────────────────────────
  const projectManager = new ProjectManager();

  // ── 2. Start Bots ──────────────────────────────────────────────────────────
  const discordBot = enableDiscord ? new DiscordBot(projectManager) : null;

  if (discordBot) {
    await discordBot.start();
    console.log("[Discord] Bot started successfully");
  }

  // ── 3. Start Express Server ───────────────────────────────────────────────
  const app = createServer(projectManager, discordBot);
  app.listen(PORT, () => {
    console.log(`[Server] HTTP server listening on http://localhost:${PORT}`);
    console.log(`[Server] Routes:`);
    console.log(`         GET  /health`);
    if (discordBot) {
      console.log(`         POST /api/webhooks/discord`);
    }
    console.log(`         GET  /projects`);
    console.log(`         POST /projects/reload`);
    console.log(`         POST /sync`);
    console.log(`         POST /run/:projectId  { "prompt": "..." }`);
  });

  // ── 4. Graceful Shutdown ──────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[Main] Received ${signal}. Shutting down...`);

    if (discordBot) {
      await discordBot.shutdown();
    }

    await shutdownOpenCodeRunner();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("uncaughtException", (err) => {
    console.error("[Main] Uncaught exception:", err);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[Main] Unhandled rejection:", reason);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
