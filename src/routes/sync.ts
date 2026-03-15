import { Router, Response as ExpressResponse } from "express";
import { DiscordBot } from "../bots/discord-bot";
import { success, error, StatusCodes } from "../shared/api-response";

export function createSyncRouter(discordBot: DiscordBot | null): Router {
  const router = Router();

  router.post("/", async (_req, res: ExpressResponse) => {
    try {
      if (discordBot) {
        await discordBot.syncChannels();
      }
      success(res, { ok: true }, "Sync completed successfully");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  });

  return router;
}
