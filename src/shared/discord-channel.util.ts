import { DISCORD_MANAGE_CHANNEL_PREFIX } from "./constants";

export function getManageChannelName(projectName: string): string {
  return `${DISCORD_MANAGE_CHANNEL_PREFIX}${projectName}`.trim();
}
