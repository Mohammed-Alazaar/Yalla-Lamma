import type { AppServer, AppSocket } from "../lib/types";
import { handleHostCreate } from "./host";
import { handlePlayerJoin } from "./player";
import { handleHostRejoin, handlePlayerRejoin } from "./rejoin";
import { handleVipConfigure } from "./vip";
import { handleDisconnect } from "./disconnect";

/** Wire all event handlers for a freshly connected socket. */
export function registerHandlers(io: AppServer, socket: AppSocket): void {
  socket.on("host:create", (payload) => {
    void handleHostCreate(io, socket, payload);
  });
  socket.on("host:rejoin", (payload) => {
    void handleHostRejoin(io, socket, payload);
  });
  socket.on("player:join", (payload) => {
    void handlePlayerJoin(io, socket, payload);
  });
  socket.on("player:rejoin", (payload) => {
    void handlePlayerRejoin(io, socket, payload);
  });
  socket.on("vip:configure", (payload) => {
    void handleVipConfigure(io, socket, payload);
  });
  socket.on("disconnect", () => {
    void handleDisconnect(io, socket);
  });
  // vip:start, vip:next, vip:playAgain, player:answer, host:kick — Phases 5 & 6.
}
