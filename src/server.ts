import express, {
  Request as ExpressRequest,
  Response as ExpressResponse,
  NextFunction,
} from "express";
import cors from "cors";
import { ProjectManager } from "./services/project-manager";
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
  createTelemetryRouter,
  createChannelConfigRouter,
} from "./routes";
import { success, error, StatusCodes } from "./shared/api-response";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

export function createServer(
  projectManager: ProjectManager,
  discordBot: DiscordBot | null,
): express.Application {
  const app = express();

  const webBuildPath = path.join(__dirname, "..", "dist", "web");

  app.use(cors());
  app.use(express.json());

  if (discordBot) {
    app.post(
      "/api/webhooks/discord",
      express.raw({ type: "*/*" }),
      async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const webRequest = toWebRequest(req);
          const webResponse = await discordBot.handleWebhook(webRequest);
          await writeWebResponse(res, webResponse);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          error(res, message, StatusCodes.INTERNAL_SERVER_ERROR);
        }
      },
    );
  }

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
      error(res, "Unauthorized", StatusCodes.UNAUTHORIZED);
      return;
    }
    next();
  }

  app.use("/health", createHealthRouter(projectManager, discordBot));
  app.use("/api/logs", createLogsRouter());
  app.use("/api/project", createProjectsRouter(projectManager, discordBot));
  app.use("/sync", requireSecret, createSyncRouter(discordBot));
  app.use("/run", requireSecret, createRunRouter(projectManager, discordBot));
  app.use("/api/secrets", createSecretsRouter());
  app.use("/api/agent", createAgentRouter());
  app.use("/api/cron-jobs", createCronJobsRouter(projectManager, discordBot));
  app.use("/api/jobs", createJobsRouter());
  app.use("/api/telemetry", createTelemetryRouter());
  app.use("/api/channel-configs", createChannelConfigRouter(discordBot));

  if (fs.existsSync(webBuildPath)) {
    app.use("/web", express.static(webBuildPath));

    app.get("/web/*", (_req, res) => {
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
