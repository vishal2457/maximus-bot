import keytar from "keytar";

const SERVICE_NAME = "maximus-bot";

export const APP_SECRETS = {
  JWT_SECRET: "jwt_secret",
  OPENCODE_API_KEY: "opencode_api_key",
} as const;

export const ALL_SECRETS = {
  ...APP_SECRETS,
} as const;

export type SecretKey = string;

export async function setSecret(key: SecretKey, value: string): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, key, value);
}

export async function updateSecret(
  key: SecretKey,
  value: string,
): Promise<boolean> {
  const existing = await keytar.getPassword(SERVICE_NAME, key);
  if (!existing) {
    return false;
  }
  await keytar.setPassword(SERVICE_NAME, key, value);
  return true;
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
