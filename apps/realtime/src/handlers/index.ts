import type { AppServer, AppSocket } from "../lib/types";
import { handleHostCreate } from "./host";
import { handlePlayerJoin } from "./player";
import { handleHostRejoin, handlePlayerRejoin } from "./rejoin";
import {
  handleVipConfigure,
  handleVipNext,
  handleVipPlayAgain,
  handleVipStart,
} from "./vip";
import { handlePlayerAnswer } from "./answer";
import { handleHostKick, handleHostLock } from "./moderation";
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
  socket.on("vip:start", () => {
    void handleVipStart(io, socket);
  });
  socket.on("vip:next", () => {
    void handleVipNext(io, socket);
  });
  socket.on("vip:playAgain", () => {
    void handleVipPlayAgain(io, socket);
  });
  socket.on("player:answer", (payload) => {
    void handlePlayerAnswer(io, socket, payload);
  });
  socket.on("host:kick", (payload) => {
    void handleHostKick(io, socket, payload);
  });
  socket.on("host:lock", (payload) => {
    void handleHostLock(io, socket, payload);
  });
  socket.on("disconnect", () => {
    void handleDisconnect(io, socket);
  });
}
