import { useQuery, useMutation } from "@tanstack/react-query";
import baseApi from "../axios/base";

export type AgentType = "opencode" | "codex";

export type AgentResponse = {
  activeAgent: AgentType;
};

export const agentKeys = {
  all: ["agent"] as const,
  detail: () => [...agentKeys.all, "detail"] as const,
};

export function useAgent() {
  return useQuery({
    queryKey: agentKeys.detail(),
    queryFn: async () => {
      const response = await baseApi.get<AgentResponse>("/agent");
      return response.data.result;
    },
  });
}

export function useSetAgent() {
  return useMutation({
    mutationFn: async (agent: AgentType) => {
      const response = await baseApi.post<AgentResponse>("/agent", { agent });
      return response.data.result;
    },
  });
}
