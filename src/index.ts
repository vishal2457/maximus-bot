import "dotenv/config";
import http from "http";
import { ProjectManager } from "./services/project-manager";
import { createServer } from "./server";
import { createSocketServer } from "./realtime/socket-server";
import { chatService } from "./services/chat-service";
import { logger } from "./shared/logger";
import { jobProcessor } from "./services/job-processor";

const PORT = parseInt(process.env.PORT || "0", 10);
const HOST = process.env.HOST || "0.0.0.0";

async function main(): Promise<void> {
  logger.info("Starting Maximus Bot");

  const projectManager = new ProjectManager();

  await jobProcessor.start();

  const app = createServer(projectManager);
  const httpServer = http.createServer(app);
  const io = createSocketServer(httpServer);

  chatService.setSocketIO(io);

  httpServer.listen(PORT, HOST, () => {
    const address = httpServer.address();
    const actualPort =
      typeof address === "object" && address ? address.port : PORT;
    logger.info("HTTP server listening", {
      url: `http://${HOST}:${actualPort}`,
      port: actualPort,
      routes: [
        "GET /health",
        "POST /api/auth/setup",
        "POST /api/auth/login",
        "POST /api/auth/refresh",
        "GET /api/project",
        "POST /run/:projectId",
        "GET /api/chat/channels",
        "GET /api/chat/projects/:id/sessions",
        "WS /socket.io/",
      ],
    });
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info("Received shutdown signal", { signal });

    await jobProcessor.stop();
    await chatService.shutdown();

    httpServer.close();
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
  console.log(err);
  logger.error("Fatal startup error", { error: err });
  process.exit(1);
});
