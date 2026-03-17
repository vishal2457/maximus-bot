import {
  Router,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import * as fs from "fs";
import * as path from "path";
import { error, StatusCodes } from "../shared/api-response";

export function createLogsRouter(): Router {
  const router = Router();

  router.get("/all", async (_req: ExpressRequest, res: ExpressResponse) => {
    try {
      const debugLog = await getLatestLogContent("debug");
      const errorLog = await getLatestLogContent("error");

      const combinedLogs = [
        ...debugLog.map((l) => ({ ...l, source: "debug" })),
        ...errorLog.map((l) => ({ ...l, source: "error" })),
      ].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      res.json({ result: combinedLogs });
    } catch (err) {
      console.error("Error reading log files:", err);
      error(res, "Failed to read log files", StatusCodes.INTERNAL_SERVER_ERROR);
    }
  });

  router.get("/:type", async (_req: ExpressRequest, res: ExpressResponse) => {
    const { type } = _req.params;
    if (!["debug", "error"].includes(type)) {
      error(
        res,
        "Invalid log type. Use 'debug', 'error', or 'all'.",
        StatusCodes.BAD_REQUEST,
      );
      return;
    }

    try {
      const logs = await getLatestLogContent(type);
      res.json({ result: logs });
    } catch (err) {
      console.error("Error reading log file:", err);
      error(res, "Failed to read log file", StatusCodes.INTERNAL_SERVER_ERROR);
    }
  });

  return router;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  service?: string;
  source: string;
}

async function getLatestLogContent(type: string): Promise<LogEntry[]> {
  const logDir = path.join(__dirname, "..", "..", "logs", type);
  const files = fs.readdirSync(logDir);
  const logFiles = files.filter((file) => file.endsWith(".log"));
  if (logFiles.length === 0) {
    return [];
  }
  logFiles.sort().reverse();
  const latestLogFile = logFiles[0];
  const logPath = path.join(logDir, latestLogFile);
  const logContent = fs.readFileSync(logPath, "utf8");

  const logs: LogEntry[] = [];
  const lines = logContent.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const parsed = JSON.parse(line);
      if (parsed.level && parsed.message) {
        logs.push({
          id: `${type}-${i}`,
          timestamp: parsed.timestamp || "",
          level: parsed.level.toUpperCase(),
          message: parsed.message,
          service: parsed.service,
          source: type,
        });
      }
    } catch {
      // Not JSON, skip
    }
  }

  return logs;
}
