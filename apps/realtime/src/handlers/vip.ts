import { ERROR_CODES, vipConfigureSchema } from "@yalla/shared";
import { store, withRoomLock } from "../store";
import { broadcastState, emitError } from "../lib/respond";
import { parsePayload } from "../lib/validate";
import type { AppServer, AppSocket } from "../lib/types";

/** VIP updates game settings in the lobby (PRD LOB-3). */
export async function handleVipConfigure(
  io: AppServer,
  socket: AppSocket,
  payload: unknown,
): Promise<void> {
  const data = parsePayload(socket, vipConfigureSchema, payload);
  if (!data) return;

  const code = socket.data.roomCode;
  if (!code || socket.data.role !== "player") {
    emitError(socket, ERROR_CODES.NOT_VIP, "Only the VIP can configure the game");
    return;
  }

  const result = await withRoomLock(code, async () => {
    const room = await store.get(code);
    if (!room) {
      return { ok: false, code: ERROR_CODES.ROOM_NOT_FOUND, message: "Room not found" } as const;
    }
    if (room.vipPlayerId !== socket.data.playerId) {
      return { ok: false, code: ERROR_CODES.NOT_VIP, message: "Only the VIP can configure the game" } as const;
    }
    if (room.phase !== "lobby") {
      return { ok: false, code: ERROR_CODES.WRONG_PHASE, message: "Game already started" } as const;
    }
    room.settings.category = data.category;
    room.settings.numQuestions = data.numQuestions;
    room.settings.timeLimitSec = data.timeLimitSec;
    await store.save(room);
    return { ok: true, room } as const;
  });

  if (!result.ok) {
    emitError(socket, result.code, result.message);
    return;
  }
  broadcastState(io, result.room);
}
