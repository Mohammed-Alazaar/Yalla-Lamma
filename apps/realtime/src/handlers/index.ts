import type { AppServer, AppSocket } from "../lib/types";
import { handleHostCreate } from "./host";
import { handlePlayerJoin } from "./player";
import { handleHostRejoin, handlePlayerRejoin } from "./rejoin";
import {
  handleVipChangeGame,
  handleVipConfigure,
  handleVipConfigureFib,
  handleVipConfigureQuip,
  handleVipNext,
  handleVipPlayAgain,
  handleVipSelectGame,
  handleVipStart,
} from "./vip";
import { handlePlayerAnswer } from "./answer";
import { handleHostKick, handleHostLock } from "./moderation";
import { handleHostSkipAnswer, handleQuipSubmitAnswer, handleQuipVote } from "./quip";
import { handleFibPick, handleFibSubmitLie, handleHostSkipOption } from "./fib";
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
  socket.on("vip:selectGame", (payload) => {
    void handleVipSelectGame(io, socket, payload);
  });
  socket.on("vip:configure", (payload) => {
    void handleVipConfigure(io, socket, payload);
  });
  socket.on("vip:configureQuip", (payload) => {
    void handleVipConfigureQuip(io, socket, payload);
  });
  socket.on("vip:configureFib", (payload) => {
    void handleVipConfigureFib(io, socket, payload);
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
  socket.on("vip:changeGame", () => {
    void handleVipChangeGame(io, socket);
  });
  socket.on("player:answer", (payload) => {
    void handlePlayerAnswer(io, socket, payload);
  });
  socket.on("quip:submitAnswer", (payload) => {
    void handleQuipSubmitAnswer(io, socket, payload);
  });
  socket.on("quip:vote", (payload) => {
    void handleQuipVote(io, socket, payload);
  });
  socket.on("host:skipAnswer", (payload) => {
    void handleHostSkipAnswer(io, socket, payload);
  });
  socket.on("fib:submitLie", (payload) => {
    void handleFibSubmitLie(io, socket, payload);
  });
  socket.on("fib:pick", (payload) => {
    void handleFibPick(io, socket, payload);
  });
  socket.on("host:skipOption", (payload) => {
    void handleHostSkipOption(io, socket, payload);
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
