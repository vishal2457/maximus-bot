import { useAgent, useTelemetry } from "@/lib/api";
import {
  Activity,
  Cpu,
  HardDrive,
  Network,
  Thermometer,
  Zap,
  Server,
  Clock,
} from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(0) + "KB";
  }
  if (bytes < 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(0) + "MB";
  }
  const gb = bytes / (1024 * 1024 * 1024);
  return gb.toFixed(1) + "GB";
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}H ${minutes}M`;
}

export const HomePage = () => {
  const { data: agentData } = useAgent();
  const { data: telemetry } = useTelemetry();

  const activeAgent = agentData?.activeAgent ?? "opencode";

  const agentDisplay =
    activeAgent === "opencode"
      ? "OpenCode"
      : activeAgent === "codex"
        ? "Codex"
        : activeAgent;

  const cpuUsage = telemetry?.cpu?.usage ?? 0;
  const processMemUsed = telemetry?.processMemory?.rss ?? 0;
  const processMemTotal = telemetry?.processMemory?.heapTotal ?? 1;
  const memoryPercent = (processMemUsed / processMemTotal) * 100;
  const processUptime = telemetry?.uptime?.process ?? 0;
  const cpuCores = telemetry?.cpu?.cores ?? 0;

  const cpuHistory = Array.from({ length: 12 }, () => Math.random() * 100);
  cpuHistory[cpuHistory.length - 1] = cpuUsage;

  const stats = [
    {
      label: "CPU Core Usage",
      value: cpuUsage.toFixed(1),
      unit: "%",
      status: cpuUsage > 80 ? "WARN" : "OK",
      icon: Cpu,
      color: cpuUsage > 80 ? "#FF4400" : "#00FF41",
    },
    {
      label: "Memory Allocation",
      value: formatBytes(processMemUsed),
      unit: "",
      status: "OK",
      icon: HardDrive,
      color: "#00FF41",
      total: formatBytes(processMemTotal),
      percent: memoryPercent,
    },
    {
      label: "Network I/O",
      value: "0.0",
      unit: "MB/s",
      status: "OK",
      icon: Network,
      color: "#00FF41",
    },
    {
      label: "Core Temp",
      value: "--",
      unit: "°C",
      status: "",
      icon: Thermometer,
      color: "#E0E0E0",
    },
    {
      label: "CPU Cores",
      value: cpuCores.toString(),
      unit: "",
      status: "",
      icon: Activity,
      color: "#E0E0E0",
    },
    {
      label: "Power Draw",
      value: "--",
      unit: "W",
      status: "",
      icon: Zap,
      color: "#E0E0E0",
    },
    {
      label: "Active Port",
      value: "3000",
      unit: "",
      status: "LISTENING",
      icon: Server,
      color: "#00FF41",
    },
    {
      label: "System Uptime",
      value: formatUptime(processUptime),
      unit: "",
      status: "",
      icon: Clock,
      color: "#E0E0E0",
    },
  ];

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="border-b border-[#333] pb-4 mb-6">
        <h1 className="text-4xl font-bold uppercase tracking-wider text-white">
          System Telemetry
        </h1>
        <p className="text-[#777] font-mono text-sm mt-1">
          NODE: LOCALHOST:3000 // AGENT: {agentDisplay.toUpperCase()}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="border border-[#333] bg-[#0D0D0D] p-5 relative overflow-hidden"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {stat.status && (
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#FF4400] to-transparent opacity-50" />
              )}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2 text-[#777] uppercase text-xs font-bold tracking-widest">
                  <Icon size={14} /> {stat.label}
                </div>
                {stat.status && (
                  <span
                    className="font-mono text-sm"
                    style={{ color: stat.color }}
                  >
                    {stat.status}
                  </span>
                )}
              </div>
              <div className="text-5xl font-mono text-white mb-4">
                {stat.value}
                {stat.unit && (
                  <span className="text-xl text-[#555]">{stat.unit}</span>
                )}
              </div>
              {stat.label === "CPU Core Usage" && (
                <div className="flex gap-1 h-12 items-end">
                  {cpuHistory.map((val: number, i: number) => (
                    <div
                      key={i}
                      className="flex-1 bg-[#FF4400]"
                      style={{
                        height: `${val}%`,
                        opacity: val > 80 ? 1 : 0.4,
                      }}
                    />
                  ))}
                </div>
              )}
              {stat.label === "Memory Allocation" && (
                <>
                  <div className="w-full bg-[#222] h-4 mb-1">
                    <div
                      className="bg-[#00FF41] h-full"
                      style={{ width: `${stat.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs font-mono text-[#777]">
                    <span>
                      USED: {stat.value}
                      {stat.unit}
                    </span>
                    <span>
                      TOTAL: {stat.total}
                      {stat.unit}
                    </span>
                  </div>
                </>
              )}
              {stat.label === "Active Port" && (
                <div className="text-xs font-mono text-[#777]">
                  Protocol: HTTP/WS
                </div>
              )}
              {stat.label === "System Uptime" && (
                <div className="text-xs font-mono text-[#777]">
                  Since last reboot
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
