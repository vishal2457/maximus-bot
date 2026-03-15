import { useQuery } from "@tanstack/react-query";
import baseApi from "../axios/base";

export type CronJob = {
  id: string;
  projectId: string;
  title: string;
  cronExpression: string;
  prompt: string;
  authorTag: string;
  channelId: string | null;
  threadId: string | null;
  sdkType: string;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const cronJobsKeys = {
  all: ["cronJobs"] as const,
  lists: () => [...cronJobsKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...cronJobsKeys.lists(), filters] as const,
  details: () => [...cronJobsKeys.all, "detail"] as const,
  detail: (id: string) => [...cronJobsKeys.details(), id] as const,
};

export function useCronJobs() {
  return useQuery({
    queryKey: cronJobsKeys.lists(),
    queryFn: async () => {
      const response = await baseApi.get<{ rows: CronJob[]; count: number }>(
        "/cron-jobs",
      );
      return response.data.result;
    },
  });
}
