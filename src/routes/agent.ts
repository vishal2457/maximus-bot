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

export function createAgentRouter(): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({ activeAgent: getActiveAgent() });
  });

  router.post("/", async (req: ExpressRequest, res: ExpressResponse) => {
    const { agent } = req.body as { agent?: string };

    if (!agent || (agent !== "opencode" && agent !== "codex")) {
      res.status(400).json({ error: "agent must be 'opencode' or 'codex'" });
      return;
    }

    try {
      setActiveAgent(agent);
      res.json({ activeAgent: agent });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: msg });
    }
  });

  router.post("/toggle", (_req, res) => {
    const newAgent = toggleActiveAgent();
    res.json({ activeAgent: newAgent });
  });

  return router;
}
