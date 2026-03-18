import { Router, Response as ExpressResponse } from "express";
import * as os from "os";
import * as process from "process";
import { success } from "../shared/api-response";

interface TelemetryData {
  cpu: {
    usage: number;
    model: string;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  processMemory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
  uptime: {
    system: number;
    process: number;
  };
  network: {
    hostname: string;
    platform: string;
    arch: string;
  };
  process: {
    pid: number;
    version: string;
    memoryUsage: number;
  };
}

export function createTelemetryRouter(): Router {
  const router = Router();

  router.get("/", (_req, res: ExpressResponse) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const memUsage = process.memoryUsage();

    const telemetry: TelemetryData = {
      cpu: {
        usage: getCpuUsage(),
        model: os.cpus()[0]?.model || "Unknown",
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usagePercent: (usedMem / totalMem) * 100,
      },
      processMemory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
      },
      uptime: {
        system: os.uptime(),
        process: process.uptime(),
      },
      network: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
      },
      process: {
        pid: process.pid,
        version: process.version,
        memoryUsage: process.memoryUsage().heapUsed,
      },
    };

    success(res, telemetry, "Telemetry data retrieved");
  });

  return router;
}

let lastCpuInfo: { idle: number; total: number } | null = null;

function getCpuUsage(): number {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  }

  if (!lastCpuInfo) {
    lastCpuInfo = { idle: totalIdle, total: totalTick };
    return 0;
  }

  const idleDiff = totalIdle - lastCpuInfo.idle;
  const totalDiff = totalTick - lastCpuInfo.total;
  const usage = totalDiff > 0 ? ((totalDiff - idleDiff) / totalDiff) * 100 : 0;

  lastCpuInfo = { idle: totalIdle, total: totalTick };

  return Math.round(usage * 10) / 10;
}
