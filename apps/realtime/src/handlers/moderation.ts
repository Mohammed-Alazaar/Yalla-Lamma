import {
  ERROR_CODES,
  hostKickSchema,
  hostLockSchema,
  type RoomState,
} from "@yalla/shared";
import { store, withRoomLock } from "../store";
import { broadcastState, emitError } from "../lib/respond";
import { parsePayload } from "../lib/validate";
import type { AppServer, AppSocket } from "../lib/types";

/** Host removes a player (PRD ROOM-7). Reassigns VIP if the VIP was kicked. */
export async function handleHostKick(
  io: AppServer,
  socket: AppSocket,
  payload: unknown,
): Promise<void> {
  const data = parsePayload(socket, hostKickSchema, payload);
  if (!data) return;

  const code = socket.data.roomCode;
  if (!code || socket.data.role !== "host") {
    emitError(socket, ERROR_CODES.NOT_HOST, "Only the host can remove players");
    return;
  }

  const result = await withRoomLock(code, async () => {
    const room = await store.get(code);
    if (!room) {
      return { ok: false, code: ERROR_CODES.ROOM_NOT_FOUND, message: "Room not found" } as const;
    }
    if (room.hostSocketId !== socket.id) {
      return { ok: false, code: ERROR_CODES.NOT_HOST, message: "Only the host can remove players" } as const;
    }
    if (!room.players[data.playerId]) {
      return { ok: true, room, kickedId: null } as const; // already gone — no-op
    }

    delete room.players[data.playerId];
    for (const [sessionId, playerId] of Object.entries(room.sessions)) {
      if (playerId === data.playerId) delete room.sessions[sessionId];
    }
    // Hand the VIP role to the next-oldest player if the VIP was removed.
    if (room.vipPlayerId === data.playerId) {
      const next = Object.values(room.players).sort((a, b) => a.joinedAt - b.joinedAt)[0];
      room.vipPlayerId = next?.id ?? null;
    }
    room.lastActivityAt = Date.now();
    await store.save(room);
    return { ok: true, room, kickedId: data.playerId } as const;
  });

  if (!result.ok) {
    emitError(socket, result.code, result.message);
    return;
  }

  if (result.kickedId) {
    const sockets = await io.in(code).fetchSockets();
    for (const s of sockets) {
      if (s.data.playerId === result.kickedId) {
        s.emit("kicked");
        s.leave(code);
        s.disconnect(true);
      }
    }
  }
  broadcastState(io, result.room);
}

/** Host locks/unlocks the room to new joiners (PRD ROOM-6). */
export async function handleHostLock(
  io: AppServer,
  socket: AppSocket,
  payload: unknown,
): Promise<void> {
  const data = parsePayload(socket, hostLockSchema, payload);
  if (!data) return;

  const code = socket.data.roomCode;
  if (!code || socket.data.role !== "host") {
    emitError(socket, ERROR_CODES.NOT_HOST, "Only the host can lock the room");
    return;
  }

  const result = await withRoomLock(code, async () => {
    const room = await store.get(code);
    if (!room) {
      return { ok: false as const, code: ERROR_CODES.ROOM_NOT_FOUND, message: "Room not found" };
    }
    if (room.hostSocketId !== socket.id) {
      return { ok: false as const, code: ERROR_CODES.NOT_HOST, message: "Only the host can lock the room" };
    }
    room.locked = data.locked;
    room.lastActivityAt = Date.now();
    await store.save(room);
    return { ok: true as const, room: room as RoomState };
  });

  if (!result.ok) {
    emitError(socket, result.code, result.message);
    return;
  }
  broadcastState(io, result.room);
}
