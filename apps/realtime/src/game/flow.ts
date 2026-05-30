// Flow orchestration: the impure side of gameplay. Wraps the pure engine with
// the per-room lock, persistence, auto-advance timers, and broadcasts. Single
// timer per room (replaced on each transition); a phaseSeq guard makes the
// timer-vs-early-end race safe.

import {
  ERROR_CODES,
  LEADERBOARD_MS,
  RECONNECT_GRACE_MS,
  REVEAL_MS,
  type ErrorCode,
  type RoomState,
} from "@yalla/shared";
import { store, withRoomLock } from "../store";
import { broadcastState } from "../lib/respond";
import { captureError, captureEvent } from "../lib/observability";
import type { AppServer } from "../lib/types";
import { advanceQuestion, revealAnswer, showLeaderboard, standings } from "./engine";

const roomTimers = new Map<string, ReturnType<typeof setTimeout>>();
const graceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Cancel any pending auto-advance timer for a room. */
export function clearRoomTimer(code: string): void {
  const handle = roomTimers.get(code);
  if (handle) {
    clearTimeout(handle);
    roomTimers.delete(code);
  }
}

/** Cancel the host-disconnect grace timer for a room. */
export function clearGraceTimer(code: string): void {
  const handle = graceTimers.get(code);
  if (handle) {
    clearTimeout(handle);
    graceTimers.delete(code);
  }
}

/** Cancel every pending timer (used by tests for clean teardown). */
export function clearAllRoomTimers(): void {
  for (const handle of roomTimers.values()) clearTimeout(handle);
  for (const handle of graceTimers.values()) clearTimeout(handle);
  roomTimers.clear();
  graceTimers.clear();
}

/** Duration the current phase auto-advances after, or null if it doesn't. */
function autoAdvanceDelay(room: RoomState): number | null {
  switch (room.phase) {
    case "question":
      // Remaining time from the authoritative start, so a resumed-after-pause
      // question fires at the correct wall-clock moment (RECON-4).
      return Math.max(0, room.settings.timeLimitSec * 1000 - (Date.now() - room.currentQuestionStartedAt));
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

/**
 * Host dropped (RECON-4): pause the game, freeze the auto-advance timer, and
 * start a grace countdown. If the host doesn't return, the room ends gracefully.
 */
export async function pauseForHostDisconnect(
  io: AppServer,
  code: string,
  hostSocketId: string,
): Promise<void> {
  let paused = false;

  await withRoomLock(code, async () => {
    const room = await store.get(code);
    if (!room) return;
    // Ignore if the host already reconnected on a fresh socket.
    if (room.hostSocketId !== hostSocketId) return;

    room.hostSocketId = null;
    room.hostDisconnectedAt = Date.now();
    if (room.phase !== "paused" && room.phase !== "final") {
      room.prevPhase = room.phase;
      room.phase = "paused";
    }
    room.phaseSeq += 1; // invalidate any pending auto-advance timer
    clearRoomTimer(code);
    await store.save(room);
    broadcastState(io, room);
    paused = true;
  });

  if (paused) scheduleGrace(io, code);
}

function scheduleGrace(io: AppServer, code: string): void {
  clearGraceTimer(code);
  const handle = setTimeout(() => void endAbandonedRoom(io, code), RECONNECT_GRACE_MS);
  handle.unref?.();
  graceTimers.set(code, handle);
}

/**
 * Grace window elapsed with no host (RECON-4). End an in-progress game on the
 * final screen; tear down a room abandoned in the lobby.
 */
export async function endAbandonedRoom(io: AppServer, code: string): Promise<void> {
  let toPersist: RoomState | null = null;

  await withRoomLock(code, async () => {
    const room = await store.get(code);
    if (!room) return;
    if (room.hostSocketId !== null || room.phase !== "paused") return; // host returned

    const wasInGame = room.prevPhase !== null && room.prevPhase !== "lobby";
    if (wasInGame) {
      room.phase = "final";
      room.prevPhase = null;
      room.phaseSeq += 1;
      await store.save(room);
      broadcastState(io, room);
      toPersist = room;
    } else {
      await store.delete(code);
      io.to(code).emit("error", {
        code: ERROR_CODES.ROOM_NOT_FOUND,
        message: "The host left and the room was closed",
      });
    }
  });

  clearGraceTimer(code);
  if (toPersist) await persistCompletedGame(toPersist);
}

/**
 * Host returned within the grace window: resume the paused phase, preserving the
 * remaining question time, and reschedule the auto-advance timer (RECON-4).
 * Mutates the room; the caller persists, broadcasts, and reschedules.
 */
export function resumeFromPause(room: RoomState, now: number): void {
  if (room.phase !== "paused" || room.prevPhase === null) return;
  const pausedMs = room.hostDisconnectedAt ? now - room.hostDisconnectedAt : 0;
  const resumed = room.prevPhase;
  room.phase = resumed;
  room.prevPhase = null;
  if (resumed === "question") {
    // Shift the start forward so the remaining time is preserved.
    room.currentQuestionStartedAt += pausedMs;
  }
  room.phaseSeq += 1;
}

/** Fire-and-forget CompletedGame write (no-op without a database configured). */
async function persistCompletedGame(room: RoomState): Promise<void> {
  const winner = standings(room)[0];
  captureEvent(room.code, "game_completed", {
    playerCount: Object.keys(room.players).length,
    questionCount: room.questions.length,
    category: room.settings.category,
    locale: room.settings.locale,
  });
  try {
    const { recordCompletedGame } = await import("@yalla/db");
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
    captureError(err);
    console.error(`[flow] failed to persist completed game ${room.code}:`, err);
  }
}
