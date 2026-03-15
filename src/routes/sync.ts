import { Router, Response as ExpressResponse } from "express";
import { DiscordBot } from "../bots/discord-bot";

export function createSyncRouter(discordBot: DiscordBot | null): Router {
  const router = Router();

  router.post("/", async (_req, res: ExpressResponse) => {
    try {
      if (discordBot) {
        await discordBot.syncChannels();
      }
      res.json({ ok: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
