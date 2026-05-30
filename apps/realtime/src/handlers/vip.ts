import {
  ERROR_CODES,
  MIN_PLAYERS_TO_START,
  selectQuestions,
  vipConfigureSchema,
  vipSelectGameSchema,
} from "@yalla/shared";
import { store, withRoomLock } from "../store";
import { broadcastState, emitError } from "../lib/respond";
import { parsePayload } from "../lib/validate";
import type { AppServer, AppSocket } from "../lib/types";
import { startGame, resetForReplay } from "../game/engine";
import { advancePhase, clearRoomTimer, scheduleNext } from "../game/flow";

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
    room.settings.country = data.country;
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

/** VIP picks which game to play from the lobby (SEL-1/2). */
export async function handleVipSelectGame(
  io: AppServer,
  socket: AppSocket,
  payload: unknown,
): Promise<void> {
  const data = parsePayload(socket, vipSelectGameSchema, payload);
  if (!data) return;

  const code = socket.data.roomCode;
  if (!code || socket.data.role !== "player") {
    emitError(socket, ERROR_CODES.NOT_VIP, "Only the VIP can choose the game");
    return;
  }

  const result = await withRoomLock(code, async () => {
    const room = await store.get(code);
    if (!room) {
      return { ok: false, code: ERROR_CODES.ROOM_NOT_FOUND, message: "Room not found" } as const;
    }
    if (room.vipPlayerId !== socket.data.playerId) {
      return { ok: false, code: ERROR_CODES.NOT_VIP, message: "Only the VIP can choose the game" } as const;
    }
    if (room.phase !== "lobby") {
      return { ok: false, code: ERROR_CODES.WRONG_PHASE, message: "Game already started" } as const;
    }
    room.gameId = data.gameId;
    room.lastActivityAt = Date.now();
    await store.save(room);
    return { ok: true, room } as const;
  });

  if (!result.ok) {
    emitError(socket, result.code, result.message);
    return;
  }
  broadcastState(io, result.room);
}

/** VIP starts the game (PRD LOB-4): select questions, open the first one. */
export async function handleVipStart(io: AppServer, socket: AppSocket): Promise<void> {
  const code = socket.data.roomCode;
  if (!code || socket.data.role !== "player") {
    emitError(socket, ERROR_CODES.NOT_VIP, "Only the VIP can start the game");
    return;
  }

  // Loading the question pool is async I/O; keep it inside the lock so the
  // lobby→question transition stays atomic for this room.
  const { loadQuestionPool } = await import("@yalla/db");

  const result = await withRoomLock(code, async () => {
    const room = await store.get(code);
    if (!room) {
      return { ok: false, code: ERROR_CODES.ROOM_NOT_FOUND, message: "Room not found" } as const;
    }
    if (room.vipPlayerId !== socket.data.playerId) {
      return { ok: false, code: ERROR_CODES.NOT_VIP, message: "Only the VIP can start the game" } as const;
    }
    if (room.phase !== "lobby") {
      return { ok: false, code: ERROR_CODES.WRONG_PHASE, message: "Game already started" } as const;
    }
    if (Object.keys(room.players).length < MIN_PLAYERS_TO_START) {
      return {
        ok: false,
        code: ERROR_CODES.NOT_ENOUGH_PLAYERS,
        message: `Need at least ${MIN_PLAYERS_TO_START} players to start`,
      } as const;
    }

    const pool = await loadQuestionPool(
      room.settings.locale,
      room.settings.country,
      room.settings.category,
    );
    const questions = selectQuestions(pool, room.settings.numQuestions);
    if (questions.length === 0) {
      return { ok: false, code: ERROR_CODES.INTERNAL, message: "No questions available" } as const;
    }

    room.gameId = "trivia"; // default/confirm the game on start
    startGame(room, questions, Date.now());
    room.phaseSeq += 1;
    room.lastActivityAt = Date.now();
    await store.save(room);
    return { ok: true, room } as const;
  });

  if (!result.ok) {
    emitError(socket, result.code, result.message);
    return;
  }
  broadcastState(io, result.room);
  scheduleNext(io, result.room);
}

/** VIP manually advances reveal/leaderboard/question (PRD GAME-6). */
export async function handleVipNext(io: AppServer, socket: AppSocket): Promise<void> {
  const code = socket.data.roomCode;
  if (!code || socket.data.role !== "player") {
    emitError(socket, ERROR_CODES.NOT_VIP, "Only the VIP can advance the game");
    return;
  }
  await advancePhase(io, code, {
    requireVip: socket.data.playerId,
    onError: (errCode, message) => emitError(socket, errCode, message),
  });
}

/** VIP restarts with the same players, scores cleared (PRD GAME-9). */
export async function handleVipPlayAgain(io: AppServer, socket: AppSocket): Promise<void> {
  const code = socket.data.roomCode;
  if (!code || socket.data.role !== "player") {
    emitError(socket, ERROR_CODES.NOT_VIP, "Only the VIP can restart the game");
    return;
  }

  const result = await withRoomLock(code, async () => {
    const room = await store.get(code);
    if (!room) {
      return { ok: false, code: ERROR_CODES.ROOM_NOT_FOUND, message: "Room not found" } as const;
    }
    if (room.vipPlayerId !== socket.data.playerId) {
      return { ok: false, code: ERROR_CODES.NOT_VIP, message: "Only the VIP can restart the game" } as const;
    }
    if (room.phase !== "final") {
      return { ok: false, code: ERROR_CODES.WRONG_PHASE, message: "Game is not finished" } as const;
    }
    resetForReplay(room);
    room.phaseSeq += 1;
    room.lastActivityAt = Date.now();
    await store.save(room);
    return { ok: true, room } as const;
  });

  if (!result.ok) {
    emitError(socket, result.code, result.message);
    return;
  }
  clearRoomTimer(code);
  broadcastState(io, result.room);
}
