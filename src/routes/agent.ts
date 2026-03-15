import {
  Router,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import {
  getActiveAgent,
  setActiveAgent,
  toggleActiveAgent,
} from "../agent-manager";
import {
  success,
  error as apiError,
  StatusCodes,
} from "../shared/api-response";

export function createAgentRouter(): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    success(res, { activeAgent: getActiveAgent() }, "Active agent fetched");
  });

  router.post("/", async (req: ExpressRequest, res: ExpressResponse) => {
    const { agent } = req.body as { agent?: string };

    if (!agent || (agent !== "opencode" && agent !== "codex")) {
      apiError(
        res,
        "agent must be 'opencode' or 'codex'",
        StatusCodes.BAD_REQUEST,
      );
      return;
    }

    try {
      setActiveAgent(agent);
      success(res, { activeAgent: agent }, "Agent set successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      apiError(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  });

  router.post("/toggle", (_req, res) => {
    const newAgent = toggleActiveAgent();
    success(res, { activeAgent: newAgent }, "Agent toggled successfully");
  });

  return router;
}
