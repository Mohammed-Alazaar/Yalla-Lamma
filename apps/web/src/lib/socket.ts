"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@yalla/shared";
import { useGameStore } from "./game-store";

// Note the swapped generic order vs the server: <ServerToClient, ClientToServer>.
export type AppClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppClientSocket | null = null;
let bound = false;

function realtimeUrl(): string {
  return process.env.NEXT_PUBLIC_REALTIME_URL ?? "ws://localhost:8080";
}

/** Lazily create the singleton socket (WebSocket-only — see scalability plan). */
export function getSocket(): AppClientSocket {
  if (!socket) {
    socket = io(realtimeUrl(), {
      transports: ["websocket"],
      autoConnect: true,
    });
  }
  return socket;
}

/** Idempotently wire socket lifecycle + state/error events into the store. */
export function bindSocket(): AppClientSocket {
  const s = getSocket();
  if (bound) return s;
  bound = true;

  const store = useGameStore.getState();
  s.on("connect", () => store.setStatus("connected"));
  s.on("disconnect", () => store.setStatus("disconnected"));
  s.io.on("reconnect_attempt", () => store.setStatus("connecting"));
  s.on("state", (state) => store.setRoom(state));
  s.on("error", (err) => store.setError(err));
  s.on("player:session", ({ playerId }) => store.setSelfPlayerId(playerId));

  store.setStatus(s.connected ? "connected" : "connecting");
  return s;
}

/** Emit once connected (queues until the socket opens). */
export function emitWhenReady<E extends keyof ClientToServerEvents>(
  event: E,
  ...args: Parameters<ClientToServerEvents[E]>
): void {
  const s = getSocket();
  if (s.connected) {
    s.emit(event, ...args);
  } else {
    s.once("connect", () => s.emit(event, ...args));
  }
}
