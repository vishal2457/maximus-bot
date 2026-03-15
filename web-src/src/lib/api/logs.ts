import { useQuery } from "@tanstack/react-query";
import baseApi from "../axios/base";

export type LogType = "debug" | "error";

export const logsKeys = {
  all: ["logs"] as const,
  lists: () => [...logsKeys.all, "list"] as const,
  list: (type: LogType) => [...logsKeys.lists(), type] as const,
};

export function useLogs(type: LogType) {
  return useQuery({
    queryKey: logsKeys.list(type),
    queryFn: async () => {
      const response = await baseApi.get<string>(`/logs/${type}`);
      return response.data.result;
    },
  });
}
