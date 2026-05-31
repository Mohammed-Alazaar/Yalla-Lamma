import {
  ERROR_CODES,
  FIB_MIN_PLAYERS,
  MIN_PLAYERS_TO_START,
  QUIP_MIN_PLAYERS,
  selectQuestions,
  vipConfigureFibSchema,
  vipConfigureQuipSchema,
  vipConfigureSchema,
  vipSelectGameSchema,
} from "@yalla/shared";
import { store, withRoomLock } from "../store";
import { broadcastState, emitError } from "../lib/respond";
import { parsePayload } from "../lib/validate";
import type { AppServer, AppSocket } from "../lib/types";
import { startGame, resetForReplay } from "../game/engine";
import { advancePhase, clearRoomTimer, scheduleNext } from "../game/flow";
import { initQuip } from "../games/quip/engine";
import { advanceQuip, scheduleNextQuip } from "../games/quip/flow";
import { initFib } from "../games/fib/engine";
import { advanceFib, scheduleNextFib } from "../games/fib/flow";

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

/** VIP returns to the game-picker from the lobby (SEL-5). */
export async function handleVipChangeGame(io: AppServer, socket: AppSocket): Promise<void> {
  const code = socket.data.roomCode;
  if (!code || socket.data.role !== "player") {
    emitError(socket, ERROR_CODES.NOT_VIP, "Only the VIP can change the game");
    return;
  }

  const result = await withRoomLock(code, async () => {
    const room = await store.get(code);
    if (!room) {
      return { ok: false, code: ERROR_CODES.ROOM_NOT_FOUND, message: "Room not found" } as const;
    }
    if (room.vipPlayerId !== socket.data.playerId) {
      return { ok: false, code: ERROR_CODES.NOT_VIP, message: "Only the VIP can change the game" } as const;
    }
    if (room.phase !== "lobby") {
      return { ok: false, code: ERROR_CODES.WRONG_PHASE, message: "Game already started" } as const;
    }
    room.gameId = null;
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

/** VIP configures QuipParty settings in the lobby (QSET-1..5). */
export async function handleVipConfigureQuip(
  io: AppServer,
  socket: AppSocket,
  payload: unknown,
): Promise<void> {
  const data = parsePayload(socket, vipConfigureQuipSchema, payload);
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
    room.quipSettings = { ...data };
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

/** VIP configures FibParty settings in the lobby (FSET-1..5). */
export async function handleVipConfigureFib(
  io: AppServer,
  socket: AppSocket,
  payload: unknown,
): Promise<void> {
  const data = parsePayload(socket, vipConfigureFibSchema, payload);
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
    room.fibSettings = { ...data };
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

  // Loading the prompt/question pool is async I/O; keep it inside the lock so
  // the lobby→game transition stays atomic for this room.
  const db = await import("@yalla/db");

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
    const playerCount = Object.keys(room.players).length;

    // ── QuipParty ──────────────────────────────────────────────────────────
    if (room.gameId === "quip") {
      if (playerCount < QUIP_MIN_PLAYERS) {
        return {
          ok: false,
          code: ERROR_CODES.NOT_ENOUGH_PLAYERS,
          message: `QuipParty needs at least ${QUIP_MIN_PLAYERS} players`,
        } as const;
      }
      const pool = await db.loadPromptPool(room.settings.locale, room.quipSettings.familyFriendly);
      const reserved = db.selectPrompts(pool, room.quipSettings.totalRounds * playerCount);
      if (reserved.length < playerCount) {
        return { ok: false, code: ERROR_CODES.INTERNAL, message: "Not enough prompts available" } as const;
      }
      // Cap rounds if the pool can't fill them all without repeats.
      const maxRounds = Math.max(1, Math.floor(reserved.length / playerCount));
      const settings = {
        ...room.quipSettings,
        totalRounds: Math.min(room.quipSettings.totalRounds, maxRounds),
      };
      initQuip(room, settings, reserved, Date.now());
      room.lastActivityAt = Date.now();
      await store.save(room);
      return { ok: true, room, game: "quip" } as const;
    }

    // ── FibParty ───────────────────────────────────────────────────────────
    if (room.gameId === "fib") {
      if (playerCount < FIB_MIN_PLAYERS) {
        return {
          ok: false,
          code: ERROR_CODES.NOT_ENOUGH_PLAYERS,
          message: `FibParty needs at least ${FIB_MIN_PLAYERS} players`,
        } as const;
      }
      const pool = await db.loadFactPool(
        room.settings.locale,
        room.fibSettings.category,
        room.fibSettings.familyFriendly,
      );
      const facts = db.selectFacts(pool, room.fibSettings.totalQuestions);
      if (facts.length === 0) {
        return { ok: false, code: ERROR_CODES.INTERNAL, message: "No facts available" } as const;
      }
      initFib(room, { ...room.fibSettings }, facts, Date.now());
      room.lastActivityAt = Date.now();
      await store.save(room);
      return { ok: true, room, game: "fib" } as const;
    }

    // ── Trivia ─────────────────────────────────────────────────────────────
    if (playerCount < MIN_PLAYERS_TO_START) {
      return {
        ok: false,
        code: ERROR_CODES.NOT_ENOUGH_PLAYERS,
        message: `Need at least ${MIN_PLAYERS_TO_START} players to start`,
      } as const;
    }
    const pool = await db.loadQuestionPool(
      room.settings.locale,
      room.settings.country,
      room.settings.category,
    );
    const questions = selectQuestions(pool, room.settings.numQuestions);
    if (questions.length === 0) {
      return { ok: false, code: ERROR_CODES.INTERNAL, message: "No questions available" } as const;
    }

    if (!room.gameId) room.gameId = "trivia"; // default when picker was skipped
    startGame(room, questions, Date.now());
    room.phaseSeq += 1;
    room.lastActivityAt = Date.now();
    await store.save(room);
    return { ok: true, room, game: "trivia" } as const;
  });

  if (!result.ok) {
    emitError(socket, result.code, result.message);
    return;
  }
  broadcastState(io, result.room);
  if (result.game === "quip") scheduleNextQuip(io, result.room);
  else if (result.game === "fib") scheduleNextFib(io, result.room);
  else scheduleNext(io, result.room);
}

/** VIP manually advances reveal/leaderboard/question (PRD GAME-6). */
export async function handleVipNext(io: AppServer, socket: AppSocket): Promise<void> {
  const code = socket.data.roomCode;
  if (!code || socket.data.role !== "player") {
    emitError(socket, ERROR_CODES.NOT_VIP, "Only the VIP can advance the game");
    return;
  }
  const room = await store.get(code);
  const advance =
    room?.gameId === "quip" ? advanceQuip : room?.gameId === "fib" ? advanceFib : advancePhase;
  await advance(io, code, {
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
