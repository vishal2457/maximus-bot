import {
  Router,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import * as fs from "fs";
import * as path from "path";

export function createLogsRouter(): Router {
  const router = Router();

  router.get("/:type", async (_req: ExpressRequest, res: ExpressResponse) => {
    const { type } = _req.params;
    if (!["debug", "error"].includes(type)) {
      res
        .status(400)
        .json({ error: "Invalid log type. Use 'debug' or 'error'." });
      return;
    }

    try {
      const logDir = path.join(__dirname, "..", "..", "logs", type);
      const files = fs.readdirSync(logDir);
      const logFiles = files.filter((file) => file.endsWith(".log"));
      if (logFiles.length === 0) {
        res.status(404).json({ error: `No log files found for type ${type}` });
        return;
      }
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

  return router;
}
