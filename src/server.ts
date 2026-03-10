import express, { Request, Response, NextFunction } from "express";
import { ProjectManager } from "./projectManager";
import { DiscordBot } from "./discordBot";
import { runOpenCode, formatResultForDiscord } from "./openCodeRunner";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

export function createServer(
  projectManager: ProjectManager,
  bot: DiscordBot
): express.Application {
  const app = express();
  app.use(express.json());

  // ─── Auth Middleware ──────────────────────────────────────────────────────
  function requireSecret(req: Request, res: Response, next: NextFunction): void {
    if (!WEBHOOK_SECRET) {
      next();
      return;
    }
    const sig = req.headers["x-webhook-secret"];
    if (sig !== WEBHOOK_SECRET) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  }

  // ─── Routes ──────────────────────────────────────────────────────────────

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      discord: bot.client.isReady() ? "connected" : "disconnected",
      projects: projectManager.getAll().length,
    });
  });

  // List all projects
  app.get("/projects", (_req, res) => {
    res.json(projectManager.getAll());
  });

  // Reload projects.json from disk
  app.post("/projects/reload", requireSecret, (_req, res) => {
    projectManager.reload();
    res.json({ ok: true, projects: projectManager.getAll().length });
  });

  // Sync Discord channels (create any missing ones)
  app.post("/sync", requireSecret, async (_req, res) => {
    try {
      await bot.syncChannels();
      res.json({ ok: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // Run OpenCode for a specific project via HTTP
  // POST /run/:projectId  { "prompt": "..." }
  app.post("/run/:projectId", requireSecret, async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { prompt } = req.body as { prompt?: string };

    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    const project = projectManager.getById(projectId);
    if (!project) {
      res.status(404).json({ error: `Project "${projectId}" not found` });
      return;
    }

    console.log(`[Server] /run/${projectId} triggered via HTTP`);

    // Run OpenCode
    const result = await runOpenCode(prompt, project.folder);

    // Optionally post result to Discord
    if (project.discordChannelId && bot.client.isReady()) {
      try {
        const channel = await bot.client.channels.fetch(project.discordChannelId);
        if (channel?.isTextBased()) {
          const msg = formatResultForDiscord(result, project.name);
          // @ts-expect-error TextBasedChannel send
          await channel.send(`📡 *Triggered via HTTP*\n> ${prompt.slice(0, 200)}\n\n${msg}`);
        }
      } catch (e) {
        console.warn("[Server] Could not post to Discord:", e);
      }
    }

    res.json({
      projectId,
      success: result.success,
      output: result.output,
      error: result.error,
      exitCode: result.exitCode,
      duration: result.duration,
    });
  });

  return app;
}
