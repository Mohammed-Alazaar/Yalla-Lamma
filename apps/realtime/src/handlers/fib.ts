import { z } from "zod";
import {
  containsProfanity,
  ERROR_CODES,
  FIB_LIE_MAX,
  fibPickSchema,
  hostSkipOptionSchema,
} from "@yalla/shared";
import { store, withRoomLock } from "../store";
import { broadcastState, emitError } from "../lib/respond";
import { parsePayload } from "../lib/validate";
import type { AppServer, AppSocket } from "../lib/types";
import {
  collidesWithTruth,
  recordLie,
  recordPick,
  spottingComplete,
  writingComplete,
} from "../games/fib/engine";
import { advanceFib } from "../games/fib/flow";

// Lenient parse — length/profanity/truth-collision are checked below so we can
// reply with a specific `fib:lieRejected` reason rather than a generic error.
const submitLieSchema = z.object({ factId: z.string().min(1), text: z.string().max(2000) });

/** Strip HTML tags + collapse whitespace so player text is never markup (FNFR-2). */
function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** A player submits a lie for the current fact (FLIE-2..5). */
export async function handleFibSubmitLie(
  io: AppServer,
  socket: AppSocket,
  payload: unknown,
): Promise<void> {
  const data = parsePayload(socket, submitLieSchema, payload);
  if (!data) return;

  const playerId = socket.data.playerId;
  const code = socket.data.roomCode;
  if (!code || socket.data.role !== "player" || !playerId) {
    emitError(socket, ERROR_CODES.WRONG_PHASE, "You are not in a game");
    return;
  }

  const text = sanitizeText(data.text);
  if (text.length === 0) {
    socket.emit("fib:lieRejected", { factId: data.factId, reason: "empty" });
    return;
  }
  if (text.length > FIB_LIE_MAX) {
    socket.emit("fib:lieRejected", { factId: data.factId, reason: "tooLong" });
    return;
  }
  if (containsProfanity(text)) {
    socket.emit("fib:lieRejected", { factId: data.factId, reason: "profanity" });
    return;
  }

  let rejectedTruth = false;
  let earlyEndSeq: number | null = null;
  const ok = await withRoomLock(code, async () => {
    const room = await store.get(code);
    if (!room || room.gameId !== "fib" || !room.fib) return null;
    // Truth-collision needs the current truth, so check it under the lock (FLIE-5).
    if (room.fib.phase === "writing" && collidesWithTruth(room, text)) {
      rejectedTruth = true;
      return null;
    }
    const outcome = recordLie(room, playerId, data.factId, text);
    if (!outcome.accepted) {
      if (outcome.reason === "too_close_to_truth") rejectedTruth = true;
      return null;
    }
    room.lastActivityAt = Date.now();
    await store.save(room);
    if (writingComplete(room)) earlyEndSeq = room.fib.seq;
    return room;
  });

  if (rejectedTruth) {
    socket.emit("fib:lieRejected", { factId: data.factId, reason: "tooCloseToTruth" });
    return;
  }
  if (!ok) return;
  broadcastState(io, ok);
  if (earlyEndSeq !== null) await advanceFib(io, code, { expectedSeq: earlyEndSeq });
}

/** A player picks the answer they believe is the truth (FSPOT-3/4). */
export async function handleFibPick(
  io: AppServer,
  socket: AppSocket,
  payload: unknown,
): Promise<void> {
  const data = parsePayload(socket, fibPickSchema, payload);
  if (!data) return;

  const playerId = socket.data.playerId;
  const code = socket.data.roomCode;
  if (!code || socket.data.role !== "player" || !playerId) {
    emitError(socket, ERROR_CODES.WRONG_PHASE, "You are not in a game");
    return;
  }

  let earlyEndSeq: number | null = null;
  const ok = await withRoomLock(code, async () => {
    const room = await store.get(code);
    if (!room || room.gameId !== "fib" || !room.fib) return null;
    const outcome = recordPick(room, playerId, data.optionId);
    if (!outcome.accepted) return null;
    room.lastActivityAt = Date.now();
    await store.save(room);
    if (spottingComplete(room)) earlyEndSeq = room.fib.seq;
    return room;
  });

  if (!ok) return;
  broadcastState(io, ok);
  if (earlyEndSeq !== null) await advanceFib(io, code, { expectedSeq: earlyEndSeq });
}

/** Host voids an option during spotting (FMOD-1/2). */
export async function handleHostSkipOption(
  io: AppServer,
  socket: AppSocket,
  payload: unknown,
): Promise<void> {
  const data = parsePayload(socket, hostSkipOptionSchema, payload);
  if (!data) return;

  const code = socket.data.roomCode;
  if (!code || socket.data.role !== "host") {
    emitError(socket, ERROR_CODES.NOT_HOST, "Only the host can skip an option");
    return;
  }

  const ok = await withRoomLock(code, async () => {
    const room = await store.get(code);
    if (!room || room.gameId !== "fib" || !room.fib) return null;
    if (room.hostSocketId !== socket.id) return null;
    // Only votable options during spotting can be voided — never the truth, and
    // never after reveal (which would not reverse awarded points).
    if (room.phase !== "playing" || room.fib.phase !== "spotting") return null;
    const opt = room.fib.current.options.find((o) => o.id === data.optionId);
    if (!opt || opt.source === "truth") return null;
    opt.voided = true;
    // Drop any picks already cast on the voided option so they don't score.
    for (const [pid, optId] of Object.entries(room.fib.current.picks)) {
      if (optId === data.optionId) delete room.fib.current.picks[pid];
    }
    room.lastActivityAt = Date.now();
    await store.save(room);
    return room;
  });

  if (!ok) return;
  broadcastState(io, ok);
}
