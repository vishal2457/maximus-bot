import {
  DISCORD_DEVELOPMENT_CHANNEL_PREFIX,
  DISCORD_LEGACY_DEVELOPMENT_CHANNEL_NAME,
} from "./constants";

export function getDevelopmentChannelName(projectName: string): string {
  return `${DISCORD_DEVELOPMENT_CHANNEL_PREFIX}${projectName}`.trim();
}

export function isLegacyDevelopmentChannelName(name: string): boolean {
  return (
    name.trim().toLowerCase() ===
    DISCORD_LEGACY_DEVELOPMENT_CHANNEL_NAME.toLowerCase()
  );
}
