import {
  Router,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import { setSecret, deleteSecret, getAllSecrets } from "../secrets-manager";

export function createSecretsRouter(): Router {
  const router = Router();

  router.get("/", async (_req, res: ExpressResponse) => {
    try {
      const secrets = await getAllSecrets();
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(secrets)) {
        result[key] = value ?? "";
      }
      res.json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: msg });
    }
  });

  router.post("/", async (req: ExpressRequest, res: ExpressResponse) => {
    const { key, value } = req.body as { key?: string; value?: string };

    if (!key || !value) {
      res.status(400).json({ error: "key and value are required" });
      return;
    }

    try {
      await setSecret(key, value);
      res.json({ ok: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: msg });
    }
  });

  router.delete("/:key", async (req: ExpressRequest, res: ExpressResponse) => {
    const { key } = req.params;

    if (!key) {
      res.status(400).json({ error: "key is required" });
      return;
    }

    try {
      await deleteSecret(key);
      res.json({ ok: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
