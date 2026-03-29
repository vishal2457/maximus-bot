import { Server as SocketIOServer, type Socket } from "socket.io";
import type { Server as HTTPServer } from "http";
import { verifySocketToken } from "../auth/jwt";
import { chatService } from "../services/chat-service";
import { logger } from "../shared/logger";

export function createSocketServer(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const payload = verifySocketToken(token);
    if (!payload) {
      return next(new Error("Invalid or expired token"));
    }

    (socket as any).userId = payload.userId;
    (socket as any).username = payload.username;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId;
    const username = (socket as any).username;

    logger.info("Socket connected", {
      socketId: socket.id,
      userId,
      username,
    });

    chatService.registerSocketHandlers(socket);

    socket.on("disconnect", (reason) => {
      logger.info("Socket disconnected", {
        socketId: socket.id,
        userId,
        reason,
      });
    });
  });

  chatService.setSocketIO(io);

  logger.info("Socket.IO server initialized");
  return io;
}
