import { useQuery, useMutation } from "@tanstack/react-query";
import baseApi from "../axios/base";

export type SecretsResponse = {
  discord_bot_token: string;
  discord_guild_id: string;
  discord_application_id: string;
  discord_public_key: string;
  discord_webhook_url: string;
};

export const secretsKeys = {
  all: ["secrets"] as const,
  detail: () => [...secretsKeys.all, "detail"] as const,
};

export function useSecrets() {
  return useQuery({
    queryKey: secretsKeys.detail(),
    queryFn: async () => {
      const response = await baseApi.get<SecretsResponse>("/secrets");
      return response.data.result;
    },
  });
}

export function useSaveSecret() {
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const response = await baseApi.post<{ message: string }>("/secrets", {
        key,
        value,
      });
      return response.data.result;
    },
  });
}
