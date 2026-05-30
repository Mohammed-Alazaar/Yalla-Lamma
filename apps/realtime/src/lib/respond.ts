import { toPublicRoomState, type ErrorCode, type RoomState } from "@yalla/shared";
import type { AppServer, AppSocket } from "./types";

/** Broadcast the redacted room state to everyone in the room (PRD §5.4). */
export function broadcastState(io: AppServer, room: RoomState): void {
  io.to(room.code).emit("state", toPublicRoomState(room));
}

/** Send the redacted room state to a single socket (e.g. just after joining). */
export function sendState(socket: AppSocket, room: RoomState): void {
  socket.emit("state", toPublicRoomState(room));
}

/** Emit a structured error to the offending client only (PRD §8.2). */
export function emitError(
  socket: AppSocket,
  code: ErrorCode,
  message: string,
): void {
  socket.emit("error", { code, message });
}
