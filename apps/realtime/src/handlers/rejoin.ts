import {
  ERROR_CODES,
  hostRejoinSchema,
  playerRejoinSchema,
} from "@yalla/shared";
import { store, withRoomLock } from "../store";
import { broadcastState, emitError } from "../lib/respond";
import { parsePayload } from "../lib/validate";
import type { AppServer, AppSocket } from "../lib/types";
import { clearGraceTimer, resumeFromPause, scheduleNext } from "../game/flow";
import { scheduleNextQuip } from "../games/quip/flow";

/** Host reconnect (RECON-4): validate token, restore seat, resume if paused. */
export async function handleHostRejoin(
  io: AppServer,
  socket: AppSocket,
  payload: unknown,
): Promise<void> {
  const data = parsePayload(socket, hostRejoinSchema, payload);
  if (!data) return;

  const result = await withRoomLock(data.code, async () => {
    const room = await store.get(data.code);
    if (!room) {
      return { ok: false, code: ERROR_CODES.ROOM_NOT_FOUND, message: "Room not found" } as const;
    }
    if (room.hostToken !== data.hostToken) {
      return { ok: false, code: ERROR_CODES.NOT_HOST, message: "Invalid host token" } as const;
    }
    resumeFromPause(room, Date.now());
    room.hostSocketId = socket.id;
    room.hostDisconnectedAt = null;
    await store.save(room);
    return { ok: true, room } as const;
  });

  if (!result.ok) {
    emitError(socket, result.code, result.message);
    return;
  }
  socket.data.roomCode = data.code;
  socket.data.role = "host";
  await socket.join(data.code);
  clearGraceTimer(data.code);
  broadcastState(io, result.room);
  // Re-arm the right game's auto-advance timer if mid-game.
  if (result.room.gameId === "quip") scheduleNextQuip(io, result.room);
  else scheduleNext(io, result.room);
}

/** Player reconnect (RECON-2): restore seat + score by sessionId. */
export async function handlePlayerRejoin(
  io: AppServer,
  socket: AppSocket,
  payload: unknown,
): Promise<void> {
  const data = parsePayload(socket, playerRejoinSchema, payload);
  if (!data) return;

  const result = await withRoomLock(data.code, async () => {
    const room = await store.get(data.code);
    if (!room) {
      return { ok: false, code: ERROR_CODES.ROOM_NOT_FOUND, message: "Room not found" } as const;
    }
    const playerId = room.sessions[data.sessionId];
    const player = playerId ? room.players[playerId] : undefined;
    if (!playerId || !player) {
      return { ok: false, code: ERROR_CODES.SESSION_INVALID, message: "Session expired" } as const;
    }
    player.connected = true;
    await store.save(room);
    return { ok: true, room, playerId } as const;
  });

  if (!result.ok) {
    emitError(socket, result.code, result.message);
    return;
  }
  socket.data.roomCode = data.code;
  socket.data.role = "player";
  socket.data.playerId = result.playerId;
  await socket.join(data.code);
  socket.emit("player:session", {
    sessionId: data.sessionId,
    playerId: result.playerId,
  });
  broadcastState(io, result.room);
}
