import type { OpencodeClient } from "@opencode-ai/sdk/v2" with {
  "resolution-mode": "import",
};
import type { Server as SocketIOServer } from "socket.io";
import { logger } from "../shared/logger";
import { getActiveAgent } from "../agent-manager";

type OpencodeRuntime = {
  client: OpencodeClient;
  server: { url: string; close(): void };
  abortController: AbortController;
  eventLoopPromise: Promise<void> | null;
};

type DynamicImport = <T>(specifier: string) => Promise<T>;

const dynamicImport = new Function(
  "moduleSpecifier",
  "return import(moduleSpecifier)",
) as DynamicImport;

type SdkModule = {
  createOpencode: (options: Record<string, unknown>) => Promise<{
    client: OpencodeClient;
    server: { url: string; close(): void };
  }>;
};

export class OpencodeRuntimeManager {
  private runtimes: Map<string, OpencodeRuntime> = new Map();
  private io: SocketIOServer | null = null;
  private sdkPromise: Promise<SdkModule> | null = null;

  setSocketIO(io: SocketIOServer): void {
    this.io = io;
  }

  private async loadSdk(): Promise<SdkModule> {
    if (!this.sdkPromise) {
      this.sdkPromise = dynamicImport<SdkModule>("@opencode-ai/sdk/v2");
    }
    return this.sdkPromise;
  }

  private async findAvailablePort(startPort: number): Promise<number> {
    const net = await import("net");
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(startPort, "127.0.0.1", () => {
        const addr = server.address();
        const port = typeof addr === "object" && addr ? addr.port : startPort;
        server.close(() => resolve(port));
      });
      server.on("error", () => {
        this.findAvailablePort(startPort + 1).then(resolve, reject);
      });
    });
  }

  async startProject(
    projectId: string,
    workingDir: string,
  ): Promise<OpencodeClient> {
    if (this.runtimes.has(projectId)) {
      const existing = this.runtimes.get(projectId)!;
      try {
        await existing.client.global.health();
        logger.debug("Reusing existing OpenCode runtime", { projectId });
        return existing.client;
      } catch {
        logger.warn("Existing runtime unhealthy, restarting", { projectId });
        await this.stopProject(projectId);
      }
    }

    logger.info("Starting OpenCode runtime", { projectId, workingDir });

    const sdk = await this.loadSdk();
    const permissionMode = process.env.OPENCODE_PERMISSION_MODE || "allow";
    const port = await this.findAvailablePort(
      4096 + Math.floor(Math.random() * 1000),
    );

    const created = await sdk.createOpencode({
      hostname: "127.0.0.1",
      port,
      timeout: parseInt(
        process.env.OPENCODE_SERVER_START_TIMEOUT_MS || "30000",
        10,
      ),
      config: {
        permission: {
          edit: permissionMode,
          bash: permissionMode,
          webfetch: permissionMode,
          external_directory: "deny",
        },
      },
    });

    const abortController = new AbortController();

    const runtime: OpencodeRuntime = {
      client: created.client,
      server: created.server,
      abortController,
      eventLoopPromise: null,
    };

    this.runtimes.set(projectId, runtime);

    logger.info("OpenCode runtime started", {
      projectId,
      url: created.server.url,
    });

    this.startEventBridge(projectId, workingDir);

    return created.client;
  }

  private async startEventBridge(
    projectId: string,
    workingDir: string,
  ): Promise<void> {
    const runtime = this.runtimes.get(projectId);
    if (!runtime) return;

    const bridgeLoop = async () => {
      try {
        const eventStream = await runtime.client.event.subscribe(
          { directory: workingDir },
          { signal: runtime.abortController.signal },
        );

        logger.info("Event bridge started", { projectId });

        for await (const event of eventStream.stream) {
          if (runtime.abortController.signal.aborted) break;

          try {
            const eventType = (event as Record<string, unknown>).type as string;
            if (!eventType) {
              logger.debug("Event bridge: event without type", {
                projectId,
                event,
              });
              continue;
            }

            logger.info("Event bridge: received event", {
              projectId,
              type: eventType,
            });

            const roomId = `project:${projectId}`;
            this.io?.to(roomId).emit("opencode:event", {
              projectId,
              type: eventType,
              data: event,
            });

            this.handleSpecificEvent(projectId, eventType, event);
          } catch (emitError) {
            logger.debug("Event emit error", {
              projectId,
              error: emitError,
            });
          }
        }
      } catch (err) {
        if (runtime.abortController.signal.aborted) return;
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn("Event bridge disconnected, reconnecting", {
          projectId,
          error: msg,
        });
        await new Promise((r) => setTimeout(r, 2000));
        if (!runtime.abortController.signal.aborted) {
          return bridgeLoop();
        }
      }
    };

    runtime.eventLoopPromise = bridgeLoop();
  }

  private handleSpecificEvent(
    projectId: string,
    eventType: string,
    event: unknown,
  ): void {
    const data = event as Record<string, unknown>;
    const roomId = `project:${projectId}`;

    switch (eventType) {
      case "session.created":
        this.io?.to(roomId).emit("session:created", {
          projectId,
          session: data,
        });
        break;
      case "session.updated":
        this.io?.to(roomId).emit("session:updated", {
          projectId,
          session: data,
        });
        break;
      case "session.status": {
        const statusData = data as { sessionID?: string; status?: unknown };
        this.io?.to(roomId).emit("session:status", {
          projectId,
          sessionId: statusData.sessionID,
          status: statusData.status,
        });
        break;
      }
      case "session.idle": {
        const idleData = data as { sessionID?: string };
        this.io?.to(roomId).emit("session:idle", {
          projectId,
          sessionId: idleData.sessionID,
        });
        break;
      }
      case "session.error": {
        const errData = data as { sessionID?: string; error?: unknown };
        this.io?.to(roomId).emit("session:error", {
          projectId,
          sessionId: errData.sessionID,
          error: errData.error,
        });
        break;
      }
      case "message.updated": {
        const msgData = data as { sessionID?: string; message?: unknown };
        this.io?.to(roomId).emit("message:updated", {
          projectId,
          sessionId: msgData.sessionID,
          message: msgData.message,
        });
        break;
      }
      case "message.part.delta": {
        const deltaData = data as {
          sessionID?: string;
          messageID?: string;
          partID?: string;
          delta?: unknown;
        };
        this.io?.to(roomId).emit("message:part:delta", {
          projectId,
          sessionId: deltaData.sessionID,
          messageId: deltaData.messageID,
          partId: deltaData.partID,
          delta: deltaData.delta,
        });
        break;
      }
      case "message.part.updated": {
        const partData = data as {
          sessionID?: string;
          messageID?: string;
          part?: unknown;
        };
        this.io?.to(roomId).emit("message:part:updated", {
          projectId,
          sessionId: partData.sessionID,
          messageId: partData.messageID,
          part: partData.part,
        });
        break;
      }
      case "permission.asked": {
        const permData = data as {
          id?: string;
          sessionID?: string;
          permission?: string;
          patterns?: string[];
          metadata?: Record<string, unknown>;
        };
        this.io?.to(roomId).emit("permission:asked", {
          projectId,
          requestId: permData.id,
          sessionId: permData.sessionID,
          permission: permData.permission,
          patterns: permData.patterns,
          metadata: permData.metadata,
        });
        break;
      }
      case "question.asked": {
        const qData = data as {
          id?: string;
          sessionID?: string;
          questions?: unknown[];
        };
        this.io?.to(roomId).emit("question:asked", {
          projectId,
          requestId: qData.id,
          sessionId: qData.sessionID,
          questions: qData.questions,
        });
        break;
      }
      case "permission.replied":
      case "question.replied":
      case "question.rejected":
        this.io?.to(roomId).emit("interaction:resolved", {
          projectId,
          type: eventType,
          data,
        });
        break;
    }
  }

  async stopProject(projectId: string): Promise<void> {
    const runtime = this.runtimes.get(projectId);
    if (!runtime) return;

    logger.info("Stopping OpenCode runtime", { projectId });
    runtime.abortController.abort();

    try {
      runtime.server.close();
    } catch {
      // ignore close errors
    }

    this.runtimes.delete(projectId);
    logger.info("OpenCode runtime stopped", { projectId });
  }

  getClient(projectId: string): OpencodeClient | null {
    return this.runtimes.get(projectId)?.client || null;
  }

  hasRuntime(projectId: string): boolean {
    return this.runtimes.has(projectId);
  }

  getActiveProjectIds(): string[] {
    return Array.from(this.runtimes.keys());
  }

  async shutdownAll(): Promise<void> {
    const projectIds = Array.from(this.runtimes.keys());
    for (const projectId of projectIds) {
      await this.stopProject(projectId);
    }
    logger.info("All OpenCode runtimes stopped");
  }
}

export const opencodeRuntimeManager = new OpencodeRuntimeManager();
