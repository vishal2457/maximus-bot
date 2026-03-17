import { useState } from "react";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  source: string;
  message: string;
}

const mockLogs: LogEntry[] = [
  {
    id: "1",
    timestamp: "2026-03-16T06:50:01Z",
    level: "INFO",
    source: "system",
    message: "Agent OpenCode initialized successfully.",
  },
  {
    id: "2",
    timestamp: "2026-03-16T06:50:15Z",
    level: "DEBUG",
    source: "network",
    message:
      "Establishing connection to workspace /Users/dev/projects/ecommerce-api",
  },
  {
    id: "3",
    timestamp: "2026-03-16T06:51:02Z",
    level: "WARN",
    source: "memory",
    message: "High memory usage detected in container 0x4F2A",
  },
  {
    id: "4",
    timestamp: "2026-03-16T06:51:45Z",
    level: "ERROR",
    source: "agent:OpenCode",
    message: "Failed to parse AST for file src/main.ts: Unexpected token",
  },
  {
    id: "5",
    timestamp: "2026-03-16T06:52:10Z",
    level: "INFO",
    source: "cron",
    message: 'Job "Daily DB Backup" triggered.',
  },
  {
    id: "6",
    timestamp: "2026-03-16T06:52:15Z",
    level: "INFO",
    source: "cron",
    message: 'Job "Daily DB Backup" completed in 4.2s.',
  },
  {
    id: "7",
    timestamp: "2026-03-16T06:53:01Z",
    level: "DEBUG",
    source: "fs",
    message: "File modified: src/components/Button.tsx",
  },
  {
    id: "8",
    timestamp: "2026-03-16T06:53:05Z",
    level: "INFO",
    source: "agent:OpenCode",
    message: "Running linter on modified files...",
  },
];

export const LogsPage = () => {
  const [filter, setFilter] = useState<string>("ALL");

  const filteredLogs =
    filter === "ALL" ? mockLogs : mockLogs.filter((l) => l.level === filter);

  return (
    <div className="space-y-6 p-4 md:p-8 h-full flex flex-col min-h-[600px]">
      <div className="border-b border-[#333] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold uppercase tracking-wider text-white">
            System Logs
          </h1>
          <p className="text-[#777] font-mono text-sm mt-1">
            REAL-TIME EVENT STREAM
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {["ALL", "INFO", "WARN", "ERROR", "DEBUG"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 font-mono text-xs border transition-colors ${
                filter === f
                  ? "border-[#FF4400] text-[#FF4400] bg-[#FF4400]/10"
                  : "border-[#333] text-[#777] hover:border-[#555] hover:text-[#CCC]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-[#050505] border border-[#333] p-4 font-mono text-sm overflow-y-auto relative">
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] z-10" />

        <div className="space-y-1 relative z-20">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col sm:flex-row gap-2 sm:gap-4 hover:bg-[#111] p-1"
            >
              <span className="text-[#555] shrink-0">
                {log.timestamp.split("T")[1].replace("Z", "")}
              </span>
              <span
                className={`shrink-0 w-12 ${
                  log.level === "INFO"
                    ? "text-[#00FF41]"
                    : log.level === "WARN"
                      ? "text-[#F2A900]"
                      : log.level === "ERROR"
                        ? "text-[#FF4400]"
                        : "text-[#888]"
                }`}
              >
                [{log.level}]
              </span>
              <span className="text-[#777] shrink-0 sm:w-24 truncate">
                [{log.source}]
              </span>
              <span className="text-[#CCC] break-all">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
