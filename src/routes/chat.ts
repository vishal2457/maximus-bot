import { Router, type Response } from "express";
import { chatService } from "../services/chat-service";
import { requireAuth, type AuthenticatedRequest } from "../auth/jwt";
import { success, error, StatusCodes } from "../shared/api-response";
import { logger } from "../shared/logger";

export function createChatRouter(): Router {
  const router = Router();

  router.use(requireAuth);

  router.get("/channels", (_req: AuthenticatedRequest, res: Response) => {
    try {
      const channels = chatService.listChannels();
      success(res, channels, "OK");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  });

  router.post(
    "/projects/:projectId/channels",
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { projectId } = req.params;
        const { name, systemPrompt } = req.body as {
          name?: string;
          systemPrompt?: string;
        };
        if (!name) {
          error(res, "name is required", StatusCodes.BAD_REQUEST);
          return;
        }
        const channel = await chatService.createChannel(
          projectId,
          name,
          systemPrompt,
        );
        success(res, channel, "Channel created", StatusCodes.CREATED);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
      }
    },
  );

  router.get(
    "/projects/:projectId/channels",
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { projectId } = req.params;
        const channels = await chatService.listProjectChannels(projectId);
        success(res, channels, "OK");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
      }
    },
  );

  router.delete(
    "/channels/:channelId",
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { channelId } = req.params;
        const deleted = await chatService.deleteChannel(channelId);
        if (!deleted) {
          error(res, "Channel not found", StatusCodes.NOT_FOUND);
          return;
        }
        success(res, { deleted: true }, "Channel deleted");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
      }
    },
  );

  router.get(
    "/projects/:projectId/sessions",
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { projectId } = req.params;
        const sessions = await chatService.listSessions(projectId, {
          limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
          search: req.query.search as string | undefined,
        });
        success(res, sessions, "OK");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
      }
    },
  );

  router.get(
    "/projects/:projectId/sessions/:sessionId",
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { projectId, sessionId } = req.params;
        const session = await chatService.getSession(projectId, sessionId);
        success(res, session, "OK");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
      }
    },
  );

  router.get(
    "/projects/:projectId/sessions/:sessionId/messages",
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { projectId, sessionId } = req.params;
        const limit = req.query.limit
          ? parseInt(req.query.limit as string, 10)
          : 50;
        const messages = await chatService.getSessionMessages(
          projectId,
          sessionId,
          limit,
        );
        success(res, messages, "OK");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
      }
    },
  );

  router.post(
    "/projects/:projectId/sessions",
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { projectId } = req.params;
        const session = await chatService.createSession(projectId);
        success(res, { session }, "Session created", StatusCodes.CREATED);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
      }
    },
  );

  router.post(
    "/projects/:projectId/sessions/:sessionId/abort",
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { projectId, sessionId } = req.params;
        await chatService.abortSession(projectId, sessionId);
        success(res, { aborted: true }, "Session aborted");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
      }
    },
  );

  router.delete(
    "/projects/:projectId/sessions/:sessionId",
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { projectId, sessionId } = req.params;
        await chatService.deleteSession(projectId, sessionId);
        success(res, { deleted: true }, "Session deleted");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
      }
    },
  );

  router.patch(
    "/projects/:projectId/sessions/:sessionId",
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { projectId, sessionId } = req.params;
        const { title } = req.body as { title?: string };
        const result = await chatService.updateSession(projectId, sessionId, {
          title,
        });
        success(res, result, "Session updated");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
      }
    },
  );

  router.post(
    "/projects/:projectId/sessions/:sessionId/fork",
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { projectId, sessionId } = req.params;
        const { messageId } = req.body as { messageId?: string };
        const result = await chatService.forkSession(
          projectId,
          sessionId,
          messageId,
        );
        success(res, result, "Session forked", StatusCodes.CREATED);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
      }
    },
  );

  router.get(
    "/projects/:projectId/sessions/:sessionId/todo",
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { projectId, sessionId } = req.params;
        const todo = await chatService.getSessionTodo(projectId, sessionId);
        success(res, todo, "OK");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
      }
    },
  );

  router.post(
    "/permissions/:requestId/reply",
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { requestId } = req.params;
        const { reply, projectId } = req.body as {
          reply?: string;
          projectId?: string;
        };
        if (!reply || !projectId) {
          error(
            res,
            "reply and projectId are required",
            StatusCodes.BAD_REQUEST,
          );
          return;
        }
        await chatService.replyPermission(requestId, reply, projectId);
        success(res, { resolved: true }, "Permission replied");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
      }
    },
  );

  router.post(
    "/questions/:requestId/reply",
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { requestId } = req.params;
        const { answers, projectId } = req.body as {
          answers?: string[][];
          projectId?: string;
        };
        if (!answers || !projectId) {
          error(
            res,
            "answers and projectId are required",
            StatusCodes.BAD_REQUEST,
          );
          return;
        }
        await chatService.replyQuestion(requestId, answers, projectId);
        success(res, { resolved: true }, "Question replied");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
      }
    },
  );

  router.post(
    "/questions/:requestId/reject",
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { requestId } = req.params;
        const { projectId } = req.body as { projectId?: string };
        if (!projectId) {
          error(res, "projectId is required", StatusCodes.BAD_REQUEST);
          return;
        }
        await chatService.rejectQuestion(requestId, projectId);
        success(res, { rejected: true }, "Question rejected");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
      }
    },
  );

  router.post(
    "/projects/:projectId/start",
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { projectId } = req.params;
        await chatService.ensureProjectRuntime(projectId);
        success(res, { started: true }, "Project runtime started");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        error(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
      }
    },
  );

  return router;
}
