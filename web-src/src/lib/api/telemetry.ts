import { useQuery } from "@tanstack/react-query";
import baseApi from "../axios/base";

export interface TelemetryData {
  cpu: {
    usage: number;
    cores: number;
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

export const telemetryKeys = {
  all: ["telemetry"] as const,
  detail: () => [...telemetryKeys.all, "detail"] as const,
};

export function useTelemetry() {
  return useQuery({
    queryKey: telemetryKeys.detail(),
    queryFn: async () => {
      const response = await baseApi.get<TelemetryData>("/telemetry");
      return response.data.result;
    },
    refetchInterval: 5000,
  });
}
