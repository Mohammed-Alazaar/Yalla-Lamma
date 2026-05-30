import { z } from "zod";
import {
  containsProfanity,
  ERROR_CODES,
  hostSkipAnswerSchema,
  QUIP_ANSWER_MAX,
  quipVoteSchema,
} from "@yalla/shared";
import { store, withRoomLock } from "../store";
import { broadcastState, emitError } from "../lib/respond";
import { parsePayload } from "../lib/validate";
import type { AppServer, AppSocket } from "../lib/types";
import { recordQuipAnswer, recordVote, votingComplete, writingComplete } from "../games/quip/engine";
import { advanceQuip } from "../games/quip/flow";

// Lenient parse — content length/profanity are checked below so we can reply
// with a specific `quip:answerRejected` reason rather than a generic error.
const submitSchema = z.object({ promptId: z.string().min(1), text: z.string().max(2000) });

/** Strip HTML tags + collapse whitespace so player text is never markup (QNFR-2). */
function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** A player submits a quip answer (ANS-1..4). */
export async function handleQuipSubmitAnswer(
  io: AppServer,
  socket: AppSocket,
  payload: unknown,
): Promise<void> {
  const data = parsePayload(socket, submitSchema, payload);
  if (!data) return;

  const playerId = socket.data.playerId;
  const code = socket.data.roomCode;
  if (!code || socket.data.role !== "player" || !playerId) {
    emitError(socket, ERROR_CODES.WRONG_PHASE, "You are not in a game");
    return;
  }

  const text = sanitizeText(data.text);
  if (text.length === 0) {
    socket.emit("quip:answerRejected", { promptId: data.promptId, reason: "empty" });
    return;
  }
  if (text.length > QUIP_ANSWER_MAX) {
    socket.emit("quip:answerRejected", { promptId: data.promptId, reason: "tooLong" });
    return;
  }
  if (containsProfanity(text)) {
    socket.emit("quip:answerRejected", { promptId: data.promptId, reason: "profanity" });
    return;
  }

  let earlyEndSeq: number | null = null;
  const ok = await withRoomLock(code, async () => {
    const room = await store.get(code);
    if (!room || room.gameId !== "quip" || !room.quip) return null;
    const outcome = recordQuipAnswer(room, playerId, data.promptId, text, Date.now());
    if (!outcome.accepted) return null;
    room.lastActivityAt = Date.now();
    await store.save(room);
    if (writingComplete(room)) earlyEndSeq = room.quip.seq;
    return room;
  });

  if (!ok) return;
  broadcastState(io, ok);
  if (earlyEndSeq !== null) await advanceQuip(io, code, { expectedSeq: earlyEndSeq });
}

/** A player votes on the current matchup (VOTE-2/3/6). */
export async function handleQuipVote(
  io: AppServer,
  socket: AppSocket,
  payload: unknown,
): Promise<void> {
  const data = parsePayload(socket, quipVoteSchema, payload);
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
    if (!room || room.gameId !== "quip" || !room.quip) return null;
    const outcome = recordVote(room, playerId, data.matchupIndex, data.choice);
    if (!outcome.accepted) return null;
    room.lastActivityAt = Date.now();
    await store.save(room);
    if (votingComplete(room)) earlyEndSeq = room.quip.seq;
    return room;
  });

  if (!ok) return;
  broadcastState(io, ok);
  if (earlyEndSeq !== null) await advanceQuip(io, code, { expectedSeq: earlyEndSeq });
}

/** Host skips/censors a matchup during voting (MOD-2). */
export async function handleHostSkipAnswer(
  io: AppServer,
  socket: AppSocket,
  payload: unknown,
): Promise<void> {
  const data = parsePayload(socket, hostSkipAnswerSchema, payload);
  if (!data) return;

  const code = socket.data.roomCode;
  if (!code || socket.data.role !== "host") {
    emitError(socket, ERROR_CODES.NOT_HOST, "Only the host can skip an answer");
    return;
  }

  let advanceSeq: number | null = null;
  const ok = await withRoomLock(code, async () => {
    const room = await store.get(code);
    if (!room || room.gameId !== "quip" || !room.quip) return null;
    if (room.hostSocketId !== socket.id) return null;
    // Only the matchup currently being voted on can be skipped — voiding an
    // already-revealed matchup wouldn't reverse its awarded points.
    if (room.phase !== "playing" || room.quip.phase !== "voting") return null;
    if (data.matchupIndex !== room.quip.currentMatchup) return null;
    const m = room.quip.matchups[data.matchupIndex];
    if (!m) return null;
    m.voided = true;
    room.lastActivityAt = Date.now();
    await store.save(room);
    advanceSeq = room.quip.seq; // move past the skipped matchup now
    return room;
  });

  if (!ok) return;
  broadcastState(io, ok);
  if (advanceSeq !== null) await advanceQuip(io, code, { expectedSeq: advanceSeq });
}
