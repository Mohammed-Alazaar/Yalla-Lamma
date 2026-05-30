// Flow orchestration: the impure side of gameplay. Wraps the pure engine with
// the per-room lock, persistence, auto-advance timers, and broadcasts. Single
// timer per room (replaced on each transition); a phaseSeq guard makes the
// timer-vs-early-end race safe.

import {
  ERROR_CODES,
  LEADERBOARD_MS,
  REVEAL_MS,
  type ErrorCode,
  type RoomState,
} from "@yalla/shared";
import { store, withRoomLock } from "../store";
import { broadcastState } from "../lib/respond";
import type { AppServer } from "../lib/types";
import { advanceQuestion, revealAnswer, showLeaderboard, standings } from "./engine";

const roomTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Cancel any pending auto-advance timer for a room. */
export function clearRoomTimer(code: string): void {
  const handle = roomTimers.get(code);
  if (handle) {
    clearTimeout(handle);
    roomTimers.delete(code);
  }
}

/** Cancel every pending timer (used by tests for clean teardown). */
export function clearAllRoomTimers(): void {
  for (const handle of roomTimers.values()) clearTimeout(handle);
  roomTimers.clear();
}

/** Duration the current phase auto-advances after, or null if it doesn't. */
function autoAdvanceDelay(room: RoomState): number | null {
  switch (room.phase) {
    case "question":
      return room.settings.timeLimitSec * 1000;
    case "reveal":
      return REVEAL_MS;
    case "leaderboard":
      return LEADERBOARD_MS;
    default:
      return null; // lobby / final / paused — no auto-advance
  }
}

/**
 * Schedule the auto-advance timer for the room's *current* phase, capturing the
 * current phaseSeq so a stale timer (one whose phase was already advanced by an
 * early all-answered end or a manual vip:next) no-ops when it fires.
 */
export function scheduleNext(io: AppServer, room: RoomState): void {
  clearRoomTimer(room.code);
  const delay = autoAdvanceDelay(room);
  if (delay === null) return;
  const expectedSeq = room.phaseSeq;
  const handle = setTimeout(() => {
    void advancePhase(io, room.code, { expectedSeq });
  }, delay);
  handle.unref?.();
  roomTimers.set(room.code, handle);
}

interface AdvanceOptions {
  /** Only advance if the room is still on this phaseSeq (stale-timer guard). */
  expectedSeq?: number;
  /** Require the actor to be the VIP (manual vip:next). */
  requireVip?: string;
  /** Surface validation failures back to the requesting socket. */
  onError?: (code: ErrorCode, message: string) => void;
}

/**
 * Move the room one phase forward: question → reveal → leaderboard → (next
 * question | final). Used by both the auto-advance timer and manual vip:next.
 */
export async function advancePhase(
  io: AppServer,
  code: string,
  opts: AdvanceOptions = {},
): Promise<void> {
  let toPersist: RoomState | null = null;

  await withRoomLock(code, async () => {
    const room = await store.get(code);
    if (!room) return;

    if (opts.expectedSeq !== undefined && room.phaseSeq !== opts.expectedSeq) {
      return; // a different transition already happened — stale timer
    }
    if (opts.requireVip !== undefined && room.vipPlayerId !== opts.requireVip) {
      opts.onError?.(ERROR_CODES.NOT_VIP, "Only the VIP can advance the game");
      return;
    }

    const now = Date.now();
    switch (room.phase) {
      case "question":
        revealAnswer(room);
        break;
      case "reveal":
        showLeaderboard(room);
        break;
      case "leaderboard": {
        const { finished } = advanceQuestion(room, now);
        if (finished) toPersist = room;
        break;
      }
      default:
        opts.onError?.(ERROR_CODES.WRONG_PHASE, "Nothing to advance right now");
        return;
    }

    room.phaseSeq += 1;
    room.lastActivityAt = now;
    await store.save(room);
    broadcastState(io, room);
    scheduleNext(io, room);
  });

  if (toPersist) await persistCompletedGame(toPersist);
}

/** Fire-and-forget CompletedGame write (no-op without a database configured). */
async function persistCompletedGame(room: RoomState): Promise<void> {
  try {
    const { recordCompletedGame } = await import("@yalla/db");
    const winner = standings(room)[0];
    await recordCompletedGame({
      roomCode: room.code,
      playerCount: Object.keys(room.players).length,
      questionIds: room.questions.map((q) => q.id),
      winnerName: winner?.name ?? "",
      startedAt: new Date(room.createdAt),
      endedAt: new Date(),
      locale: room.settings.locale,
    });
  } catch (err) {
    console.error(`[flow] failed to persist completed game ${room.code}:`, err);
  }
}
