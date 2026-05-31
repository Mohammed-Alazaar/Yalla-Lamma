// FibParty flow orchestration: wraps the pure fib engine with the room lock,
// persistence, auto-advance timers, and broadcasts. Mirrors the quip flow; a
// fib.seq guard makes the timer-vs-early-end race safe.

import {
  ERROR_CODES,
  FIB_LEADERBOARD_MS,
  FIB_REVEAL_MS,
  type ErrorCode,
  type RoomState,
} from "@yalla/shared";
import { store, withRoomLock } from "../../store";
import { broadcastState } from "../../lib/respond";
import { captureError, captureEvent } from "../../lib/observability";
import { clearRoomTimer, setRoomTimer } from "../../lib/room-timers";
import type { AppServer } from "../../lib/types";
import { standings } from "../../game/engine";
import {
  advanceAfterLeaderboard,
  revealQuestion,
  showFibLeaderboard,
  startSpotting,
} from "./engine";

/** Delay before the current fib phase auto-advances, or null if it doesn't. */
function fibDelay(room: RoomState): number | null {
  const f = room.fib;
  if (!f || room.phase !== "playing") return null;
  switch (f.phase) {
    case "writing":
    case "spotting":
      return Math.max(0, f.phaseEndsAt - Date.now());
    case "reveal":
      return FIB_REVEAL_MS;
    case "leaderboard":
      return FIB_LEADERBOARD_MS;
    default:
      return null;
  }
}

/** Schedule the fib auto-advance timer for the current phase (fib.seq guard). */
export function scheduleNextFib(io: AppServer, room: RoomState): void {
  const delay = fibDelay(room);
  if (delay === null || !room.fib) {
    clearRoomTimer(room.code);
    return;
  }
  const expectedSeq = room.fib.seq;
  setRoomTimer(room.code, delay, () => {
    void advanceFib(io, room.code, { expectedSeq });
  });
}

interface AdvanceOptions {
  expectedSeq?: number;
  requireVip?: string;
  onError?: (code: ErrorCode, message: string) => void;
}

/**
 * Move the fib game one phase forward: writing → spotting → reveal →
 * leaderboard → (next question | final). Used by the auto-advance timer, manual
 * vip:next, and early-end (all-written / all-picked).
 */
export async function advanceFib(
  io: AppServer,
  code: string,
  opts: AdvanceOptions = {},
): Promise<void> {
  let toPersist: RoomState | null = null;

  await withRoomLock(code, async () => {
    const room = await store.get(code);
    if (!room || room.gameId !== "fib" || !room.fib) return;
    if (room.phase !== "playing") return; // paused/final — don't advance the game
    const f = room.fib;

    if (opts.expectedSeq !== undefined && f.seq !== opts.expectedSeq) return; // stale
    if (opts.requireVip !== undefined && room.vipPlayerId !== opts.requireVip) {
      opts.onError?.(ERROR_CODES.NOT_VIP, "Only the VIP can advance the game");
      return;
    }

    const now = Date.now();
    switch (f.phase) {
      case "writing":
        startSpotting(room, now);
        break;
      case "spotting":
        revealQuestion(room);
        break;
      case "reveal":
        showFibLeaderboard(room);
        break;
      case "leaderboard": {
        const { finished } = advanceAfterLeaderboard(room, now);
        if (finished) toPersist = room;
        break;
      }
      default:
        opts.onError?.(ERROR_CODES.WRONG_PHASE, "Nothing to advance right now");
        return;
    }

    f.seq += 1;
    room.lastActivityAt = now;
    await store.save(room);
    broadcastState(io, room);
    scheduleNextFib(io, room);
  });

  if (toPersist) await persistFibGame(toPersist);
}

async function persistFibGame(room: RoomState): Promise<void> {
  const winner = standings(room)[0];
  captureEvent(room.code, "game_completed", {
    gameId: "fib",
    playerCount: Object.keys(room.players).length,
    questions: room.fib?.totalQuestions ?? 0,
    locale: room.settings.locale,
  });
  try {
    const { recordCompletedGame } = await import("@yalla/db");
    await recordCompletedGame({
      gameId: "fib",
      roomCode: room.code,
      playerCount: Object.keys(room.players).length,
      questionIds: room.fib?.facts.slice(0, room.fib.totalQuestions).map((f) => f.id) ?? [],
      winnerName: winner?.name ?? "",
      startedAt: new Date(room.createdAt),
      endedAt: new Date(),
      locale: room.settings.locale,
    });
  } catch (err) {
    captureError(err);
    console.error(`[fib] failed to persist completed game ${room.code}:`, err);
  }
}
