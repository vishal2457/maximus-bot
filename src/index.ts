import "dotenv/config";
import { ProjectManager } from "./projectManager";
import { DiscordBot } from "./discordBot";
import { createServer } from "./server";

const PORT = parseInt(process.env.PORT || "3000", 10);

async function main(): Promise<void> {
  console.log("🚀 Starting Discord OpenCode Bridge...");

  // Validate required env vars
  const required = ["DISCORD_TOKEN", "DISCORD_GUILD_ID"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(", ")}`);
    console.error(`   Copy .env.example to .env and fill in the values.`);
    process.exit(1);
  }

  // ── 1. Load Projects ──────────────────────────────────────────────────────
  const projectManager = new ProjectManager();

  // ── 2. Start Discord Bot ──────────────────────────────────────────────────
  const bot = new DiscordBot(projectManager);
  await bot.start();

  // ── 3. Start Express Server ───────────────────────────────────────────────
  const app = createServer(projectManager, bot);
  app.listen(PORT, () => {
    console.log(`[Server] HTTP server listening on http://localhost:${PORT}`);
    console.log(`[Server] Routes:`);
    console.log(`         GET  /health`);
    console.log(`         GET  /projects`);
    console.log(`         POST /projects/reload`);
    console.log(`         POST /sync`);
    console.log(`         POST /run/:projectId  { "prompt": "..." }`);
  });

  // ── 4. Graceful Shutdown ──────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[Main] Received ${signal}. Shutting down...`);
    bot.client.destroy();
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
  console.error("❌ Fatal startup error:", err);
  process.exit(1);
});
