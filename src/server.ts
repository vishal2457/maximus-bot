import express, {
  Request as ExpressRequest,
  Response as ExpressResponse,
  NextFunction,
} from "express";
import { ProjectManager } from "./project-manager";
import { DiscordBot } from "./bots/discord-bot";
import { runOpenCode, formatResultForDiscord } from "./open-code-runner";
import { logger } from "./shared/logger";
import * as fs from "fs";
import * as path from "path";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

export function createServer(
  projectManager: ProjectManager,
  discordBot: DiscordBot | null,
): express.Application {
  const app = express();

  // Discord interactions webhook must receive raw body for signature verification.
  if (discordBot) {
    app.post(
      "/api/webhooks/discord",
      express.raw({ type: "*/*" }),
      async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const webRequest = toWebRequest(req);
          const webResponse = await discordBot.handleWebhook(webRequest);
          await writeWebResponse(res, webResponse);
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          res.status(500).json({ error: message });
        }
      },
    );
  }

  app.use(express.json());

  // ─── Auth Middleware ──────────────────────────────────────────────────────
  function requireSecret(
    req: ExpressRequest,
    res: ExpressResponse,
    next: NextFunction,
  ): void {
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
      discord: discordBot?.isReady() ? "connected" : "disabled",
      projects: projectManager.getAll().length,
    });
  });

  // Log viewer endpoint
  app.get("/logs/:type", async (_req, res) => {
    const { type } = _req.params;
    if (!["debug", "error"].includes(type)) {
      res
        .status(400)
        .json({ error: "Invalid log type. Use 'debug' or 'error'." });
      return;
    }

    try {
      const logDir = path.join(__dirname, "..", "logs", type);
      const files = fs.readdirSync(logDir);
      const logFiles = files.filter((file) => file.endsWith(".log"));
      if (logFiles.length === 0) {
        res.status(404).json({ error: `No log files found for type ${type}` });
        return;
      }
      // Sort by filename (assuming YYYY-MM-DD.log format) to get the latest
      logFiles.sort().reverse();
      const latestLogFile = logFiles[0];
      const logPath = path.join(logDir, latestLogFile);
      const logContent = fs.readFileSync(logPath, "utf8");
      res.setHeader("Content-Type", "text/plain");
      res.send(logContent);
    } catch (error) {
      console.error("Error reading log file:", error);
      res.status(500).json({ error: "Failed to read log file" });
    }
  });

  // List all projects
  app.get("/projects", (_req, res) => {
    res.json(projectManager.getAll());
  });

  // Create new project (unauthenticated)
  app.post("/projects", async (req: ExpressRequest, res: ExpressResponse) => {
    const { name, description, folder, linearProjectId, linearProjectName } =
      req.body as {
        name?: string;
        description?: string;
        folder?: string;
        linearProjectId?: string;
        linearProjectName?: string;
      };

    if (!name || !description || !folder) {
      res
        .status(400)
        .json({ error: "name, description, and folder are required" });
      return;
    }

    const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    try {
      const newProject = projectManager.add({
        id,
        name,
        description,
        folder,
        linearProjectId,
        linearProjectName,
      });

      if (discordBot) {
        await discordBot.syncChannels();
      }

      res.status(201).json(newProject);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // Reload projects.json from disk
  app.post("/projects/reload", requireSecret, (_req, res) => {
    projectManager.reload();
    res.json({ ok: true, projects: projectManager.getAll().length });
  });

  // Sync channels (create any missing ones)
  app.post("/sync", requireSecret, async (_req, res) => {
    try {
      if (discordBot) {
        await discordBot.syncChannels();
      }
      res.json({ ok: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // Run OpenCode for a specific project via HTTP
  // POST /run/:projectId  { "prompt": "..." }
  app.post(
    "/run/:projectId",
    requireSecret,
    async (req: ExpressRequest, res: ExpressResponse) => {
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

      logger.info("OpenCode run triggered via HTTP", { projectId });

      // Run OpenCode
      const result = await runOpenCode(prompt, project.folder);

      // Optionally post result to Discord
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

      res.json({
        projectId,
        success: result.success,
        output: result.output,
        error: result.error,
        exitCode: result.exitCode,
        duration: result.duration,
      });
    },
  );

  return app;
}

function toWebRequest(req: ExpressRequest): Request {
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const url = `${proto}://${host}${req.originalUrl}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      headers.set(key, value.join(", "));
    } else {
      headers.set(key, value);
    }
  }

  const method = req.method.toUpperCase();
  const body: any =
    method === "GET" || method === "HEAD"
      ? undefined
      : (getRawBody(req) as any);

  return new Request(url, {
    method,
    headers,
    body,
  });
}

function getRawBody(req: ExpressRequest): Buffer {
  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (typeof req.body === "string") {
    return Buffer.from(req.body, "utf-8");
  }

  if (req.body && typeof req.body === "object") {
    return Buffer.from(JSON.stringify(req.body), "utf-8");
  }

  return Buffer.alloc(0);
}

async function writeWebResponse(
  res: ExpressResponse,
  response: Response,
): Promise<void> {
  res.status(response.status);

  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const raw = Buffer.from(await response.arrayBuffer());
  res.send(raw);
}
