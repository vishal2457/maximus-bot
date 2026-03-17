import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import baseApi from "../axios/base";

export type ChannelConfig = {
  id: string;
  channelId: string;
  projectId: string;
  name: string;
  systemPrompt: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateChannelConfigInput = {
  channelId: string;
  projectId: string;
  name: string;
  systemPrompt: string;
};

export type UpdateChannelConfigInput = {
  name?: string;
  systemPrompt?: string;
  channelId?: string;
  projectId?: string;
};

export type DiscordChannel = {
  id: string;
  name: string;
  type: number;
};

export const channelConfigKeys = {
  all: ["channel-configs"] as const,
  lists: () => [...channelConfigKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...channelConfigKeys.lists(), filters] as const,
  details: () => [...channelConfigKeys.all, "detail"] as const,
  detail: (id: string) => [...channelConfigKeys.details(), id] as const,
  byChannel: (channelId: string) =>
    [...channelConfigKeys.all, "channel", channelId] as const,
  byProject: (projectId: string) =>
    [...channelConfigKeys.all, "project", projectId] as const,
  channels: (projectId: string) =>
    [...channelConfigKeys.all, "channels", projectId] as const,
};

export function useChannelConfigs() {
  return useQuery<ChannelConfig[]>({
    queryKey: channelConfigKeys.lists(),
    queryFn: async () => {
      const response = await baseApi.get<ChannelConfig[]>("/channel-configs");
      return response.data.result;
    },
  });
}

export function useChannelConfig(id: string) {
  return useQuery<ChannelConfig>({
    queryKey: channelConfigKeys.detail(id),
    queryFn: async () => {
      const response = await baseApi.get<ChannelConfig>(
        `/channel-configs/${id}`,
      );
      return response.data.result;
    },
    enabled: !!id,
  });
}

export function useChannelConfigByChannelId(channelId: string) {
  return useQuery<ChannelConfig>({
    queryKey: channelConfigKeys.byChannel(channelId),
    queryFn: async () => {
      const response = await baseApi.get<ChannelConfig>(
        `/channel-configs/channel/${channelId}`,
      );
      return response.data.result;
    },
    enabled: !!channelId,
  });
}

export function useChannelConfigsByProjectId(projectId: string) {
  return useQuery<ChannelConfig[]>({
    queryKey: channelConfigKeys.byProject(projectId),
    queryFn: async () => {
      const response = await baseApi.get<ChannelConfig[]>(
        `/channel-configs/project/${projectId}`,
      );
      return response.data.result;
    },
    enabled: !!projectId,
  });
}

export function useCreateChannelConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateChannelConfigInput) => {
      const response = await baseApi.post<ChannelConfig>(
        "/channel-configs",
        input,
      );
      return response.data.result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelConfigKeys.all });
    },
  });
}

export function useUpdateChannelConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateChannelConfigInput;
    }) => {
      const response = await baseApi.put<ChannelConfig>(
        `/channel-configs/${id}`,
        input,
      );
      return response.data.result;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: channelConfigKeys.all });
      queryClient.invalidateQueries({ queryKey: channelConfigKeys.detail(id) });
    },
  });
}

export function useDeleteChannelConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await baseApi.delete<{ id: string }>(
        `/channel-configs/${id}`,
      );
      return response.data.result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelConfigKeys.all });
    },
  });
}

export function useDiscordChannels(projectId: string | undefined) {
  return useQuery<DiscordChannel[]>({
    queryKey: channelConfigKeys.channels(projectId || ""),
    queryFn: async () => {
      if (!projectId) return [];
      const response = await baseApi.get<DiscordChannel[]>(
        `/channel-configs/channels/${projectId}`,
      );
      return response.data.result;
    },
    enabled: !!projectId,
  });
}

export function useSyncChannels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await baseApi.post<{ synced: boolean }>(
        "/channel-configs/sync",
      );
      return response.data.result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelConfigKeys.all });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useCreateDiscordChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      channelName: string;
      topic?: string;
    }) => {
      const response = await baseApi.post<DiscordChannel>(
        "/channel-configs/create-channel",
        input,
      );
      return response.data.result;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: channelConfigKeys.channels(variables.projectId),
      });
    },
  });
}
