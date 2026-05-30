// QuipParty flow orchestration: wraps the pure quip engine with the room lock,
// persistence, auto-advance timers, and broadcasts. Mirrors the trivia flow; a
// quip.seq guard makes the timer-vs-early-end race safe.

import {
  ERROR_CODES,
  QUIP_LEADERBOARD_MS,
  QUIP_REVEAL_MS,
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
  revealMatchup,
  showQuipLeaderboard,
  startVoting,
} from "./engine";

/** Delay before the current quip phase auto-advances, or null if it doesn't. */
function quipDelay(room: RoomState): number | null {
  const q = room.quip;
  if (!q || room.phase !== "playing") return null;
  switch (q.phase) {
    case "writing":
    case "voting":
      return Math.max(0, q.phaseEndsAt - Date.now());
    case "reveal":
      return QUIP_REVEAL_MS;
    case "leaderboard":
      return QUIP_LEADERBOARD_MS;
    default:
      return null;
  }
}

/** Schedule the quip auto-advance timer for the current phase (quip.seq guard). */
export function scheduleNextQuip(io: AppServer, room: RoomState): void {
  const delay = quipDelay(room);
  if (delay === null || !room.quip) {
    clearRoomTimer(room.code);
    return;
  }
  const expectedSeq = room.quip.seq;
  setRoomTimer(room.code, delay, () => {
    void advanceQuip(io, room.code, { expectedSeq });
  });
}

interface AdvanceOptions {
  expectedSeq?: number;
  requireVip?: string;
  onError?: (code: ErrorCode, message: string) => void;
}

/**
 * Move the quip game one phase forward: writing → voting → reveal →
 * leaderboard → (next matchup | next round | final). Used by the auto-advance
 * timer, manual vip:next, and early-end (all-submitted / all-voted).
 */
export async function advanceQuip(
  io: AppServer,
  code: string,
  opts: AdvanceOptions = {},
): Promise<void> {
  let toPersist: RoomState | null = null;

  await withRoomLock(code, async () => {
    const room = await store.get(code);
    if (!room || room.gameId !== "quip" || !room.quip) return;
    const q = room.quip;

    if (opts.expectedSeq !== undefined && q.seq !== opts.expectedSeq) return; // stale
    if (opts.requireVip !== undefined && room.vipPlayerId !== opts.requireVip) {
      opts.onError?.(ERROR_CODES.NOT_VIP, "Only the VIP can advance the game");
      return;
    }

    const now = Date.now();
    switch (q.phase) {
      case "writing":
        startVoting(room, now);
        break;
      case "voting":
        revealMatchup(room);
        break;
      case "reveal":
        showQuipLeaderboard(room);
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

    q.seq += 1;
    room.lastActivityAt = now;
    await store.save(room);
    broadcastState(io, room);
    scheduleNextQuip(io, room);
  });

  if (toPersist) await persistQuipGame(toPersist);
}

async function persistQuipGame(room: RoomState): Promise<void> {
  const winner = standings(room)[0];
  captureEvent(room.code, "game_completed", {
    gameId: "quip",
    playerCount: Object.keys(room.players).length,
    rounds: room.quip?.totalRounds ?? 0,
    locale: room.settings.locale,
  });
  try {
    const { recordCompletedGame } = await import("@yalla/db");
    await recordCompletedGame({
      gameId: "quip",
      roomCode: room.code,
      playerCount: Object.keys(room.players).length,
      questionIds: [],
      winnerName: winner?.name ?? "",
      startedAt: new Date(room.createdAt),
      endedAt: new Date(),
      locale: room.settings.locale,
    });
  } catch (err) {
    captureError(err);
    console.error(`[quip] failed to persist completed game ${room.code}:`, err);
  }
}
