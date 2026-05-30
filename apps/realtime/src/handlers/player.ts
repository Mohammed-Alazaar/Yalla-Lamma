import {
  containsProfanity,
  ERROR_CODES,
  MAX_PLAYERS,
  newId,
  pickAvailableColor,
  playerJoinSchema,
  type ErrorCode,
  type Player,
  type RoomState,
} from "@yalla/shared";
import { store, withRoomLock } from "../store";
import { broadcastState, emitError } from "../lib/respond";
import { parsePayload } from "../lib/validate";
import type { AppServer, AppSocket } from "../lib/types";

type JoinResult =
  | { ok: true; room: RoomState; playerId: string; sessionId: string }
  | { ok: false; code: ErrorCode; message: string };

export async function handlePlayerJoin(
  io: AppServer,
  socket: AppSocket,
  payload: unknown,
): Promise<void> {
  const data = parsePayload(socket, playerJoinSchema, payload);
  if (!data) return;

  if (containsProfanity(data.name)) {
    emitError(socket, ERROR_CODES.NAME_REJECTED, "Please choose a different name");
    return;
  }

  const result = await withRoomLock(data.code, async (): Promise<JoinResult> => {
    const room = await store.get(data.code);
    if (!room) {
      return { ok: false, code: ERROR_CODES.ROOM_NOT_FOUND, message: "Room not found" };
    }
    if (room.phase !== "lobby") {
      return { ok: false, code: ERROR_CODES.WRONG_PHASE, message: "Game already started" };
    }
    if (room.locked) {
      return { ok: false, code: ERROR_CODES.ROOM_LOCKED, message: "Room is locked" };
    }

    const players = Object.values(room.players);
    if (players.length >= MAX_PLAYERS) {
      return { ok: false, code: ERROR_CODES.ROOM_FULL, message: "Room is full" };
    }
    if (players.some((p) => p.name.toLowerCase() === data.name.toLowerCase())) {
      return { ok: false, code: ERROR_CODES.NAME_TAKEN, message: "That name is taken" };
    }

    const playerId = newId();
    const sessionId = newId();
    const player: Player = {
      id: playerId,
      name: data.name,
      color: pickAvailableColor(players.map((p) => p.color)),
      score: 0,
      connected: true,
      joinedAt: Date.now(),
    };
    room.players[playerId] = player;
    room.sessions[sessionId] = playerId;
    // First joiner becomes the VIP (PRD LOB-2).
    if (!room.vipPlayerId) room.vipPlayerId = playerId;

    await store.save(room);
    return { ok: true, room, playerId, sessionId };
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
    sessionId: result.sessionId,
    playerId: result.playerId,
  });
  broadcastState(io, result.room);
}
