import { useQuery } from "@tanstack/react-query";
import baseApi from "../axios/base";

export type LogType = "debug" | "error" | "all";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  service?: string;
  source: string;
}

export const logsKeys = {
  all: ["logs"] as const,
  lists: () => [...logsKeys.all, "list"] as const,
  list: (type: LogType) => [...logsKeys.lists(), type] as const,
};

export function useLogs(type: LogType) {
  return useQuery({
    queryKey: logsKeys.list(type),
    queryFn: async () => {
      const response = await baseApi.get<LogEntry[]>(`/logs/${type}`);
      return response.data.result;
    },
  });
}
