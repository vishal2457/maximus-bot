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

  router.get("/:type", async (_req: ExpressRequest, res: ExpressResponse) => {
    const { type } = _req.params;
    if (!["debug", "error"].includes(type)) {
      error(
        res,
        "Invalid log type. Use 'debug' or 'error'.",
        StatusCodes.BAD_REQUEST,
      );
      return;
    }

    try {
      const logDir = path.join(__dirname, "..", "..", "logs", type);
      const files = fs.readdirSync(logDir);
      const logFiles = files.filter((file) => file.endsWith(".log"));
      if (logFiles.length === 0) {
        error(
          res,
          `No log files found for type ${type}`,
          StatusCodes.NOT_FOUND,
        );
        return;
      }
      logFiles.sort().reverse();
      const latestLogFile = logFiles[0];
      const logPath = path.join(logDir, latestLogFile);
      const logContent = fs.readFileSync(logPath, "utf8");
      res.setHeader("Content-Type", "text/plain");
      res.send(logContent);
    } catch (err) {
      console.error("Error reading log file:", err);
      error(res, "Failed to read log file", StatusCodes.INTERNAL_SERVER_ERROR);
    }
  });

  return router;
}
