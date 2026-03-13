import keytar from "keytar";

const SERVICE_NAME = "maximus-bot";

export const DISCORD_SECRETS = {
  BOT_TOKEN: "discord_bot_token",
  GUILD_ID: "discord_guild_id",
  APPLICATION_ID: "discord_application_id",
  PUBLIC_KEY: "discord_public_key",
  WEBHOOK_URL: "discord_webhook_url",
} as const;

export const ALL_SECRETS = {
  ...DISCORD_SECRETS,
} as const;

export type SecretKey = string;

export async function setSecret(key: SecretKey, value: string): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, key, value);
}

export async function getSecret(key: SecretKey): Promise<string | null> {
  return keytar.getPassword(SERVICE_NAME, key);
}

export async function deleteSecret(key: SecretKey): Promise<boolean> {
  return keytar.deletePassword(SERVICE_NAME, key);
}

export async function getAllSecrets(): Promise<Record<string, string | null>> {
  const credentials = await keytar.findCredentials(SERVICE_NAME);
  const result: Record<string, string | null> = {};
  for (const cred of credentials) {
    result[cred.account] = cred.password;
  }
  return result;
}

export async function getAllDiscordSecrets(): Promise<
  Record<string, string | null>
> {
  const result: Record<string, string | null> = {};
  for (const key of Object.values(DISCORD_SECRETS)) {
    result[key] = await getSecret(key);
  }
  return result;
}
