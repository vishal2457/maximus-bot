import express, {
  Request as ExpressRequest,
  Response as ExpressResponse,
  NextFunction,
} from "express";
import cors from "cors";
import { ProjectManager } from "./services/project-manager";
import * as fs from "fs";
import * as path from "path";
import {
  createHealthRouter,
  createLogsRouter,
  createProjectsRouter,
  createRunRouter,
  createSecretsRouter,
  createAgentRouter,
  createCronJobsRouter,
  createJobsRouter,
  createTelemetryRouter,
  createChannelConfigRouter,
  createAuthRouter,
  createChatRouter,
} from "./routes";
import { success, error, StatusCodes } from "./shared/api-response";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

export function createServer(
  projectManager: ProjectManager,
): express.Application {
  const app = express();

  const webBuildPath = path.join(__dirname, "..", "dist", "web");

  app.use(cors());
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
      error(res, "Unauthorized", StatusCodes.UNAUTHORIZED);
      return;
    }
    next();
  }

  app.use("/health", createHealthRouter(projectManager));
  app.use("/api/auth", createAuthRouter());
  app.use("/api/logs", createLogsRouter());
  app.use("/api/project", createProjectsRouter(projectManager));
  app.use("/run", requireSecret, createRunRouter(projectManager));
  app.use("/api/secrets", createSecretsRouter());
  app.use("/api/agent", createAgentRouter());
  app.use("/api/cron-jobs", createCronJobsRouter(projectManager));
  app.use("/api/jobs", createJobsRouter());
  app.use("/api/telemetry", createTelemetryRouter());
  app.use("/api/channel-configs", createChannelConfigRouter());
  app.use("/api/chat", createChatRouter());

  if (fs.existsSync(webBuildPath)) {
    app.use("/web", express.static(webBuildPath));

    app.get("/web/*", (_req, res) => {
      res.sendFile(path.join(webBuildPath, "index.html"));
    });
  }

  return app;
}
