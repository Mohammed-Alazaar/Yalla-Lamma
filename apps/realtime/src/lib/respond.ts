import { toPublicRoomState, type ErrorCode, type RoomState } from "@yalla/shared";
import type { AppServer, AppSocket } from "./types";

/** Broadcast the redacted room state to everyone in the room (PRD §5.4). */
export function broadcastState(io: AppServer, room: RoomState): void {
  // During quip voting/reveal, authorship is per-viewer (blind voting), so send
  // each socket its own redacted view. Otherwise a single shared payload is fine.
  const perViewer =
    room.gameId === "quip" &&
    room.quip != null &&
    (room.quip.phase === "voting" || room.quip.phase === "reveal");

  if (perViewer) {
    void io
      .in(room.code)
      .fetchSockets()
      .then((sockets) => {
        for (const s of sockets) s.emit("state", toPublicRoomState(room, s.data.playerId));
      });
    return;
  }
  io.to(room.code).emit("state", toPublicRoomState(room));
}

/** Send the redacted room state to a single socket (e.g. just after joining). */
export function sendState(socket: AppSocket, room: RoomState): void {
  socket.emit("state", toPublicRoomState(room, socket.data.playerId));
}

/** Emit a structured error to the offending client only (PRD §8.2). */
export function emitError(
  socket: AppSocket,
  code: ErrorCode,
  message: string,
): void {
  socket.emit("error", { code, message });
}
