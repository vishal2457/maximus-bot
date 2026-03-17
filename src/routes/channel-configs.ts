import {
  Router,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import { channelConfigRepository } from "../repositories/channel-config-repository";
import { projectRepository } from "../repositories/project-repository";
import {
  success,
  error as apiError,
  StatusCodes,
} from "../shared/api-response";
import { DiscordBot } from "../bots/discord-bot";

export function createChannelConfigRouter(
  discordBot: DiscordBot | null,
): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    const configs = channelConfigRepository.getAll();
    success(res, configs, "Channel configs fetched successfully");
  });

  router.get(
    "/channels/:projectId",
    async (req: ExpressRequest, res: ExpressResponse) => {
      if (!discordBot) {
        apiError(
          res,
          "Discord bot not available",
          StatusCodes.SERVICE_UNAVAILABLE,
        );
        return;
      }

      const { projectId } = req.params;
      const project = projectRepository.getById(projectId);

      if (!project) {
        apiError(res, "Project not found", StatusCodes.NOT_FOUND);
        return;
      }

      try {
        const channels = await discordBot.getChannelsForProject(projectId);
        success(res, channels, "Channels fetched successfully");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        apiError(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
      }
    },
  );

  router.post("/sync", async (_req: ExpressRequest, res: ExpressResponse) => {
    if (!discordBot) {
      apiError(
        res,
        "Discord bot not available",
        StatusCodes.SERVICE_UNAVAILABLE,
      );
      return;
    }

    try {
      await discordBot.syncChannels();
      success(res, { synced: true }, "Channels synced successfully");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      apiError(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  });

  router.post(
    "/create-channel",
    async (req: ExpressRequest, res: ExpressResponse) => {
      if (!discordBot) {
        apiError(
          res,
          "Discord bot not available",
          StatusCodes.SERVICE_UNAVAILABLE,
        );
        return;
      }

      const { projectId, channelName, topic } = req.body as {
        projectId?: string;
        channelName?: string;
        topic?: string;
      };

      if (!projectId || !channelName) {
        apiError(
          res,
          "projectId and channelName are required",
          StatusCodes.BAD_REQUEST,
        );
        return;
      }

      const project = projectRepository.getById(projectId);
      if (!project) {
        apiError(res, "Project not found", StatusCodes.NOT_FOUND);
        return;
      }

      try {
        const channel = await discordBot.createChannel(
          projectId,
          channelName,
          topic,
        );
        success(res, channel, "Channel created successfully");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        apiError(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
      }
    },
  );

  router.get("/:id", (req: ExpressRequest, res: ExpressResponse) => {
    const { id } = req.params;
    const config = channelConfigRepository.getById(id);

    if (!config) {
      apiError(res, "Channel config not found", StatusCodes.NOT_FOUND);
      return;
    }

    success(res, config, "Channel config fetched successfully");
  });

  router.get(
    "/channel/:channelId",
    (req: ExpressRequest, res: ExpressResponse) => {
      const { channelId } = req.params;
      const config = channelConfigRepository.getByChannelId(channelId);

      if (!config) {
        apiError(
          res,
          "Channel config not found for this channel",
          StatusCodes.NOT_FOUND,
        );
        return;
      }

      success(res, config, "Channel config fetched successfully");
    },
  );

  router.get(
    "/project/:projectId",
    (req: ExpressRequest, res: ExpressResponse) => {
      const { projectId } = req.params;
      const configs = channelConfigRepository.getByProjectId(projectId);
      success(res, configs, "Channel configs fetched successfully");
    },
  );

  router.post("/", async (req: ExpressRequest, res: ExpressResponse) => {
    const { channelId, projectId, name, systemPrompt } = req.body as {
      channelId?: string;
      projectId?: string;
      name?: string;
      systemPrompt?: string;
    };

    if (!channelId || !projectId || !name || !systemPrompt) {
      apiError(
        res,
        "channelId, projectId, name, and systemPrompt are required",
        StatusCodes.BAD_REQUEST,
      );
      return;
    }

    const existing = channelConfigRepository.getByChannelId(channelId);
    if (existing) {
      apiError(
        res,
        "A config already exists for this channel. Use PUT to update.",
        StatusCodes.CONFLICT,
      );
      return;
    }

    const id = `ccfg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    try {
      const config = channelConfigRepository.create({
        id,
        channelId,
        projectId,
        name,
        systemPrompt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      success(
        res,
        config,
        "Channel config created successfully",
        StatusCodes.CREATED,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      apiError(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  });

  router.put("/:id", (req: ExpressRequest, res: ExpressResponse) => {
    const { id } = req.params;
    const { name, systemPrompt, channelId, projectId } = req.body as {
      name?: string;
      systemPrompt?: string;
      channelId?: string;
      projectId?: string;
    };

    const existing = channelConfigRepository.getById(id);
    if (!existing) {
      apiError(res, "Channel config not found", StatusCodes.NOT_FOUND);
      return;
    }

    try {
      const updated = channelConfigRepository.update(id, {
        name,
        systemPrompt,
        channelId,
        projectId,
      });

      success(res, updated, "Channel config updated successfully");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      apiError(res, msg, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  });

  router.delete("/:id", (req: ExpressRequest, res: ExpressResponse) => {
    const { id } = req.params;

    const deleted = channelConfigRepository.delete(id);
    if (!deleted) {
      apiError(res, "Channel config not found", StatusCodes.NOT_FOUND);
      return;
    }

    success(res, { id }, "Channel config deleted successfully");
  });

  return router;
}
