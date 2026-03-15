import express, {
  Request as ExpressRequest,
  Response as ExpressResponse,
  NextFunction,
} from "express";
import { ProjectManager } from "./project-manager";
import { DiscordBot } from "./bots/discord-bot";
import * as fs from "fs";
import * as path from "path";
import {
  createHealthRouter,
  createLogsRouter,
  createProjectsRouter,
  createSyncRouter,
  createRunRouter,
  createSecretsRouter,
  createAgentRouter,
  createCronJobsRouter,
  createJobsRouter,
} from "./routes";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

export function createServer(
  projectManager: ProjectManager,
  discordBot: DiscordBot | null,
): express.Application {
  const app = express();

  const webBuildPath = path.join(__dirname, "..", "dist", "web");
  if (fs.existsSync(webBuildPath)) {
    app.use(express.static(webBuildPath));
  }

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

  app.use(createHealthRouter(projectManager, discordBot));
  app.use("/logs", createLogsRouter());
  app.use("/projects", createProjectsRouter(projectManager, discordBot));
  app.use("/sync", requireSecret, createSyncRouter(discordBot));
  app.use("/run", requireSecret, createRunRouter(projectManager, discordBot));
  app.use("/api/secrets", createSecretsRouter());
  app.use("/api/agent", createAgentRouter());
  app.use("/api/cron-jobs", createCronJobsRouter(projectManager, discordBot));
  app.use("/api/jobs", createJobsRouter());

  if (fs.existsSync(webBuildPath)) {
    app.get("*", (_req, res) => {
      res.sendFile(path.join(webBuildPath, "index.html"));
    });
  }

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
