import { useState } from "react";
import { useLogs, type LogEntry as ApiLogEntry } from "@/lib/api/logs";

export const LogsPage = () => {
  const [filter, setFilter] = useState<string>("ALL");
  const { data: logs = [], isLoading } = useLogs("all");

  const getLevelColor = (level: string) => {
    const l = level.toUpperCase();
    if (l === "INFO") return "text-[#00FF41]";
    if (l === "WARN" || l === "WARNING") return "text-[#F2A900]";
    if (l === "ERROR") return "text-[#FF4400]";
    return "text-[#888]";
  };

  const filteredLogs =
    filter === "ALL" ? logs : logs.filter((l) => l.level === filter);

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
        {isLoading && (
          <div className="flex items-center justify-center h-full text-[#777]">
            Loading logs...
          </div>
        )}
        {filteredLogs.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full text-[#777]">
            No logs found
          </div>
        )}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] z-10" />

        <div className="space-y-1 relative z-20">
          {filteredLogs.map((log: ApiLogEntry) => (
            <div
              key={log.id}
              className="flex flex-col sm:flex-row gap-2 sm:gap-4 hover:bg-[#111] p-1"
            >
              <span className="text-[#555] shrink-0">
                {log.timestamp
                  ? log.timestamp.split(" ")[1]?.slice(0, 8)
                  : "--:--:--"}
              </span>
              <span className={`shrink-0 w-12 ${getLevelColor(log.level)}`}>
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
