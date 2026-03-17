import { useQuery } from "@tanstack/react-query";
import baseApi from "../axios/base";

export type Project = {
  id: string;
  name: string;
  description: string;
  folder: string;
  discordCategoryId: string;
  linearIssuesChannelId: string;
  linearProjectId: string;
  linearProjectName: string;
};

export const projectsKeys = {
  all: ["projects"] as const,
  lists: () => [...projectsKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...projectsKeys.lists(), filters] as const,
  details: () => [...projectsKeys.all, "detail"] as const,
  detail: (id: string) => [...projectsKeys.details(), id] as const,
};

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: projectsKeys.lists(),
    queryFn: async () => {
      const response = await baseApi.get<Project[]>("/project");
      return response.data.result;
    },
  });
}
