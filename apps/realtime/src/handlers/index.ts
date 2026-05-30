import type { AppServer, AppSocket } from "../lib/types";
import { handleHostCreate } from "./host";
import { handlePlayerJoin } from "./player";
import { handleDisconnect } from "./disconnect";

/** Wire all event handlers for a freshly connected socket. */
export function registerHandlers(io: AppServer, socket: AppSocket): void {
  socket.on("host:create", (payload) => {
    void handleHostCreate(io, socket, payload);
  });
  socket.on("player:join", (payload) => {
    void handlePlayerJoin(io, socket, payload);
  });
  socket.on("disconnect", () => {
    void handleDisconnect(io, socket);
  });
  // vip:*, player:answer, host:kick, rejoin — added in Phases 3 & 5.
}
