import type { Server as SocketIOServer, Socket } from "socket.io";
import { opencodeRuntimeManager } from "./opencode-runtime-manager";
import { channelRepository } from "../repositories/channel-repository";
import { projectManager } from "./project-manager";
import { logger } from "../shared/logger";

type PendingPermission = {
  resolve: (reply: string) => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type PendingQuestion = {
  resolve: (answers: string[][]) => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const PERMISSION_TIMEOUT_MS = parseInt(
  process.env.PERMISSION_TIMEOUT_MS || String(15 * 60 * 1000),
  10,
);

export class ChatService {
  private io: SocketIOServer | null = null;
  private pendingPermissions: Map<string, PendingPermission> = new Map();
  private pendingQuestions: Map<string, PendingQuestion> = new Map();

  setSocketIO(io: SocketIOServer): void {
    this.io = io;
    opencodeRuntimeManager.setSocketIO(io);
  }

  async ensureProjectRuntime(projectId: string): Promise<void> {
    const project = projectManager.getById(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    if (!opencodeRuntimeManager.hasRuntime(projectId)) {
      await opencodeRuntimeManager.startProject(projectId, project.folder);
    }
  }

  private async ensureClient(projectId: string) {
    const project = projectManager.getById(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    return opencodeRuntimeManager.startProject(projectId, project.folder);
  }

  private async createSessionInOpenCode(
    client: any,
    directory: string,
  ): Promise<{
    id: string;
    slug: string;
    title: string;
    directory: string;
    time: { created: number; updated: number };
  }> {
    const result = await client.session.create({ directory });
    const data = (result as { data?: any }).data;
    if (!data?.id) throw new Error("Failed to create session");
    return {
      id: data.id,
      slug: data.slug || data.id,
      title: data.title || "",
      directory: data.directory || directory,
      time: data.time || {
        created: Date.now() / 1000,
        updated: Date.now() / 1000,
      },
    };
  }

  async createSession(projectId: string): Promise<{
    id: string;
    slug: string;
    title: string;
    directory: string;
    time: { created: number; updated: number };
  }> {
    const project = projectManager.getById(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const client = await opencodeRuntimeManager.startProject(
      projectId,
      project.folder,
    );

    const sessionData = await this.createSessionInOpenCode(
      client,
      project.folder,
    );

    logger.info("Session created via API", {
      projectId,
      sessionId: sessionData.id,
    });

    return sessionData;
  }

  async sendMessage(
    projectId: string,
    content: string,
    sessionId?: string,
  ): Promise<{ sessionId: string }> {
    const project = projectManager.getById(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const client = await opencodeRuntimeManager.startProject(
      projectId,
      project.folder,
    );

    let activeSessionId = sessionId;

    if (!activeSessionId) {
      const sessionData = await this.createSessionInOpenCode(
        client,
        project.folder,
      );
      activeSessionId = sessionData.id;

      logger.info("Session created", {
        projectId,
        sessionId: activeSessionId,
      });
    }

    logger.info("Sending prompt to OpenCode", {
      projectId,
      sessionId: activeSessionId,
      contentLength: content.length,
    });

    let promptResult;
    try {
      promptResult = await client.session.promptAsync(
        {
          sessionID: activeSessionId,
          directory: project.folder,
          parts: [{ type: "text", text: content }],
        },
        {},
      );
    } catch (promptErr) {
      logger.error("promptAsync threw an exception", {
        projectId,
        sessionId: activeSessionId,
        error:
          promptErr instanceof Error ? promptErr.message : String(promptErr),
      });
      throw promptErr;
    }

    logger.info("promptAsync returned", {
      projectId,
      sessionId: activeSessionId,
      hasError: !!(promptResult as { error?: unknown }).error,
      resultKeys: promptResult ? Object.keys(promptResult as object) : [],
    });

    if ((promptResult as { error?: unknown }).error) {
      const err = (promptResult as { error?: unknown }).error;
      throw new Error(
        `Prompt failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return { sessionId: activeSessionId };
  }

  async listSessions(projectId: string, options?: Record<string, unknown>) {
    const project = projectManager.getById(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const client = await this.ensureClient(projectId);

    const result = await client.session.list({
      directory: project.folder,
      ...(options || {}),
    });
    return (result as { data?: unknown }).data;
  }

  async getSessionMessages(
    projectId: string,
    sessionId: string,
    limit?: number,
  ) {
    const project = projectManager.getById(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const client = await this.ensureClient(projectId);

    const result = await client.session.messages({
      sessionID: sessionId,
      directory: project.folder,
      limit: limit || 50,
    });
    return (result as { data?: unknown }).data;
  }

  async getSession(projectId: string, sessionId: string) {
    const project = projectManager.getById(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const client = await this.ensureClient(projectId);

    const result = await client.session.get({
      sessionID: sessionId,
      directory: project.folder,
    });
    return (result as { data?: unknown }).data;
  }

  async abortSession(projectId: string, sessionId: string) {
    const client = await this.ensureClient(projectId);
    const project = projectManager.getById(projectId)!;

    await client.session.abort({
      sessionID: sessionId,
      directory: project.folder,
    });
  }

  async deleteSession(projectId: string, sessionId: string) {
    const client = await this.ensureClient(projectId);
    const project = projectManager.getById(projectId)!;

    await client.session.delete({
      sessionID: sessionId,
      directory: project.folder,
    });
  }

  async updateSession(
    projectId: string,
    sessionId: string,
    data: { title?: string },
  ) {
    const client = await this.ensureClient(projectId);
    const project = projectManager.getById(projectId)!;

    const result = await client.session.update({
      sessionID: sessionId,
      directory: project.folder,
      ...data,
    });
    return (result as { data?: unknown }).data;
  }

  async forkSession(projectId: string, sessionId: string, messageId?: string) {
    const client = await this.ensureClient(projectId);
    const project = projectManager.getById(projectId)!;

    const result = await client.session.fork({
      sessionID: sessionId,
      directory: project.folder,
      ...(messageId ? { messageID: messageId } : {}),
    });
    return (result as { data?: unknown }).data;
  }

  async getSessionTodo(projectId: string, sessionId: string) {
    const client = await this.ensureClient(projectId);
    const project = projectManager.getById(projectId)!;

    const result = await client.session.todo({
      sessionID: sessionId,
      directory: project.folder,
    });
    return (result as { data?: unknown }).data;
  }

  async replyPermission(requestId: string, reply: string, projectId: string) {
    const client = await this.ensureClient(projectId);
    const project = projectManager.getById(projectId)!;

    await client.permission.reply({
      requestID: requestId,
      directory: project.folder,
      reply: reply as "once" | "always" | "reject",
    });

    const pending = this.pendingPermissions.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingPermissions.delete(requestId);
      pending.resolve(reply);
    }
  }

  async replyQuestion(
    requestId: string,
    answers: string[][],
    projectId: string,
  ) {
    const client = await this.ensureClient(projectId);
    const project = projectManager.getById(projectId)!;

    await client.question.reply({
      requestID: requestId,
      directory: project.folder,
      answers,
    });

    const pending = this.pendingQuestions.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingQuestions.delete(requestId);
      pending.resolve(answers);
    }
  }

  async rejectQuestion(requestId: string, projectId: string) {
    const client = await this.ensureClient(projectId);
    const project = projectManager.getById(projectId)!;

    await client.question.reject({
      requestID: requestId,
      directory: project.folder,
    });
  }

  async listChannels() {
    return channelRepository.getAll();
  }

  async listProjectChannels(projectId: string) {
    return channelRepository.getByProjectId(projectId);
  }

  async createChannel(projectId: string, name: string, systemPrompt?: string) {
    const project = projectManager.getById(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const channel = channelRepository.create({
      id: `ch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      projectId,
      name,
      systemPrompt: systemPrompt || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return channel;
  }

  async deleteChannel(channelId: string) {
    return channelRepository.delete(channelId);
  }

  registerSocketHandlers(socket: Socket): void {
    socket.on("project:join", (projectId: string) => {
      socket.join(`project:${projectId}`);
      logger.debug("Socket joined project room", {
        socketId: socket.id,
        projectId,
      });
    });

    socket.on("project:leave", (projectId: string) => {
      socket.leave(`project:${projectId}`);
      logger.debug("Socket left project room", {
        socketId: socket.id,
        projectId,
      });
    });

    socket.on(
      "message:send",
      async (data: {
        projectId: string;
        sessionId?: string;
        content: string;
      }) => {
        logger.info("Socket: message:send received", {
          socketId: socket.id,
          projectId: data.projectId,
          sessionId: data.sessionId,
          contentLength: data.content?.length,
        });
        try {
          const result = await this.sendMessage(
            data.projectId,
            data.content,
            data.sessionId,
          );
          socket.emit("message:send:ack", {
            projectId: data.projectId,
            sessionId: result.sessionId,
            status: "sent",
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error("Socket: message:send failed", {
            socketId: socket.id,
            error: msg,
          });
          socket.emit("error", {
            event: "message:send",
            message: msg,
          });
        }
      },
    );

    socket.on("session:create", async (data: { projectId: string }) => {
      try {
        const project = projectManager.getById(data.projectId);
        if (!project) throw new Error("Project not found");

        const client = await opencodeRuntimeManager.startProject(
          data.projectId,
          project.folder,
        );
        const result = await client.session.create({
          directory: project.folder,
        });
        socket.emit("session:created", {
          projectId: data.projectId,
          session: (result as { data?: unknown }).data,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        socket.emit("error", {
          event: "session:create",
          message: msg,
        });
      }
    });

    socket.on(
      "session:abort",
      async (data: { projectId: string; sessionId: string }) => {
        try {
          await this.abortSession(data.projectId, data.sessionId);
          socket.emit("session:aborted", {
            projectId: data.projectId,
            sessionId: data.sessionId,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          socket.emit("error", {
            event: "session:abort",
            message: msg,
          });
        }
      },
    );

    socket.on(
      "permission:reply",
      async (data: { requestId: string; reply: string; projectId: string }) => {
        try {
          await this.replyPermission(
            data.requestId,
            data.reply,
            data.projectId,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          socket.emit("error", {
            event: "permission:reply",
            message: msg,
          });
        }
      },
    );

    socket.on(
      "question:reply",
      async (data: {
        requestId: string;
        answers: string[][];
        projectId: string;
      }) => {
        try {
          await this.replyQuestion(
            data.requestId,
            data.answers,
            data.projectId,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          socket.emit("error", {
            event: "question:reply",
            message: msg,
          });
        }
      },
    );
  }

  async shutdown(): Promise<void> {
    for (const [, pending] of this.pendingPermissions) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Chat service shutting down"));
    }
    for (const [, pending] of this.pendingQuestions) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Chat service shutting down"));
    }
    this.pendingPermissions.clear();
    this.pendingQuestions.clear();

    await opencodeRuntimeManager.shutdownAll();
  }
}

export const chatService = new ChatService();
