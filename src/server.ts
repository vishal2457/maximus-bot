import express, {
  Request as ExpressRequest,
  Response as ExpressResponse,
  NextFunction,
} from "express";
import { ProjectManager } from "./project-manager";
import { DiscordBot } from "./discord-bot";
import { runOpenCode, formatResultForDiscord } from "./open-code-runner";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

export function createServer(
  projectManager: ProjectManager,
  bot: DiscordBot,
): express.Application {
  const app = express();

  // Discord interactions webhook must receive raw body for signature verification.
  app.post(
    "/api/webhooks/discord",
    express.raw({ type: "*/*" }),
    async (req: ExpressRequest, res: ExpressResponse) => {
      try {
        const webRequest = toWebRequest(req);
        const webResponse = await bot.handleWebhook(webRequest);
        await writeWebResponse(res, webResponse);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    },
  );

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
      discord: bot.isReady() ? "connected" : "disconnected",
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

      console.log(`[Server] /run/${projectId} triggered via HTTP`);

      // Run OpenCode
      const result = await runOpenCode(prompt, project.folder);

      // Optionally post result to Discord
      if (project.developmentChannelId && bot.isReady()) {
        try {
          const msg = formatResultForDiscord(result, project.name);
          await bot.postToChannel(
            project.developmentChannelId,
            `📡 *Triggered via HTTP*\n> ${prompt.slice(0, 200)}\n\n${msg}`,
          );
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : String(e);
          console.warn("[Server] Could not post to Discord:", errMsg);
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
  const body: BodyInit | null | undefined =
    method === "GET" || method === "HEAD"
      ? undefined
      : (getRawBody(req) as BodyInit);

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
