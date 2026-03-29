import { io, type Socket } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket?.connected) return socket;

  const token = localStorage.getItem("accessToken");

  socket = io(API_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  });

  socket.on("connect", () => {
    console.log("[Socket.IO] Connected", socket?.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("[Socket.IO] Disconnected:", reason);
  });

  socket.on("connect_error", (err) => {
    console.error("[Socket.IO] Connection error:", err.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function updateSocketAuth(): void {
  if (socket) {
    disconnectSocket();
  }
  getSocket();
}
