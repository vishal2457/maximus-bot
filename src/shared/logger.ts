import * as winston from "winston";
import "winston-daily-rotate-file";

const logDir = "logs";
const service = process.env.LOG_SERVICE_NAME || "maximus-bot";
const level = process.env.LOG_LEVEL || "debug";

const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

const logger = winston.createLogger({
  level: level as winston.LoggerOptions["level"],
  defaultMeta: {
    service,
    env: process.env.NODE_ENV || "development",
  },
  format: jsonFormat,
  transports: [
    new winston.transports.DailyRotateFile({
      level: "debug",
      datePattern: "YYYY-MM-DD",
      dirname: `${logDir}/debug`,
      filename: "%DATE%.log",
      maxFiles: "30d",
      zippedArchive: true,
    }),
    new winston.transports.DailyRotateFile({
      level: "error",
      datePattern: "YYYY-MM-DD",
      dirname: `${logDir}/error`,
      filename: "%DATE%.log",
      maxFiles: "30d",
      handleExceptions: true,
      zippedArchive: true,
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.printf(
          ({
            timestamp,
            level: logLevel,
            message,
            ...meta
          }: any) =>
            `${timestamp} [${logLevel}] ${message}${
              Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ""
            }`,
        ),
      ),
    }),
  );
}

const stream = {
  write: (message: string) => {
    const trimmed = message.trim();
    if (trimmed) {
      logger.info(trimmed);
    }
  },
};

export { logger, stream };
