import {
  Router,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import { setSecret, deleteSecret, getAllSecrets } from "../services/secrets-manager";
import { success, error, StatusCodes } from "../shared/api-response";

export function createSecretsRouter(): Router {
  const router = Router();

  router.get("/", async (_req, res: ExpressResponse) => {
    try {
      const secrets = await getAllSecrets();
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(secrets)) {
        result[key] = value ?? "";
      }
      success(res, result, "Secrets fetched successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  });

  router.post("/", async (req: ExpressRequest, res: ExpressResponse) => {
    const { key, value } = req.body as { key?: string; value?: string };

    if (!key || !value) {
      error(res, "key and value are required", StatusCodes.BAD_REQUEST);
      return;
    }

    try {
      await setSecret(key, value);
      success(res, { ok: true }, "Secret set successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  });

  router.delete("/:key", async (req: ExpressRequest, res: ExpressResponse) => {
    const { key } = req.params;

    if (!key) {
      error(res, "key is required", StatusCodes.BAD_REQUEST);
      return;
    }

    try {
      await deleteSecret(key);
      success(res, { ok: true }, "Secret deleted successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  });

  return router;
}
