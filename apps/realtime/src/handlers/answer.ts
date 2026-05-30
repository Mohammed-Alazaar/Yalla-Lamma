import { ERROR_CODES, playerAnswerSchema, type RoomState } from "@yalla/shared";
import { store, withRoomLock } from "../store";
import { broadcastState, emitError } from "../lib/respond";
import { parsePayload } from "../lib/validate";
import type { AppServer, AppSocket } from "../lib/types";
import { allConnectedAnswered, recordAnswer } from "../game/engine";
import { advancePhase } from "../game/flow";

type AnswerResult =
  | { ok: true; room: RoomState; earlyEndSeq: number | null }
  | { ok: false; notFound: true }
  | { ok: false; notFound: false }; // rejected answer (duplicate / late / stale) — silent no-op

/** A player locks in an answer (PRD GAME-1/3). Server-authoritative scoring. */
export async function handlePlayerAnswer(
  io: AppServer,
  socket: AppSocket,
  payload: unknown,
): Promise<void> {
  const data = parsePayload(socket, playerAnswerSchema, payload);
  if (!data) return;

  const playerId = socket.data.playerId;
  const code = socket.data.roomCode;
  if (!code || socket.data.role !== "player" || !playerId) {
    emitError(socket, ERROR_CODES.WRONG_PHASE, "You are not in a game");
    return;
  }

  const result = await withRoomLock(code, async (): Promise<AnswerResult> => {
    const room = await store.get(code);
    if (!room) return { ok: false, notFound: true };

    const outcome = recordAnswer(room, playerId, data.questionId, data.choice, Date.now());
    if (!outcome.accepted) return { ok: false, notFound: false };

    room.lastActivityAt = Date.now();
    await store.save(room);
    // End the question early once every connected player has answered. Capture
    // the current phaseSeq so the advance no-ops if the timer already fired.
    const earlyEndSeq = allConnectedAnswered(room) ? room.phaseSeq : null;
    return { ok: true, room, earlyEndSeq };
  });

  if (!result.ok) {
    if (result.notFound) emitError(socket, ERROR_CODES.ROOM_NOT_FOUND, "Room not found");
    return; // rejected answers are a silent no-op (double-submit, late, stale)
  }

  broadcastState(io, result.room); // refresh the host's live answered-count
  if (result.earlyEndSeq !== null) {
    await advancePhase(io, code, { expectedSeq: result.earlyEndSeq });
  }
}
