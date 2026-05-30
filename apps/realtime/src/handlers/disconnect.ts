import { store, withRoomLock } from "../store";
import { broadcastState } from "../lib/respond";
import type { AppServer, AppSocket } from "../lib/types";
import { allConnectedAnswered } from "../game/engine";
import { advancePhase, pauseForHostDisconnect } from "../game/flow";
import { votingComplete, writingComplete } from "../games/quip/engine";
import { advanceQuip } from "../games/quip/flow";

/**
 * Handle a dropped socket. Host drop → pause + grace countdown (RECON-4).
 * Player drop → mark disconnected; if that was the last outstanding answer/vote
 * of a live round, end it early.
 */
export async function handleDisconnect(io: AppServer, socket: AppSocket): Promise<void> {
  const code = socket.data.roomCode;
  if (!code) return;

  if (socket.data.role === "host") {
    await pauseForHostDisconnect(io, code, socket.id);
    return;
  }

  let triviaSeq: number | null = null;
  let quipSeq: number | null = null;
  await withRoomLock(code, async () => {
    const room = await store.get(code);
    if (!room) return;

    if (socket.data.playerId) {
      const player = room.players[socket.data.playerId];
      if (player) player.connected = false;
    }
    room.lastActivityAt = Date.now();
    await store.save(room);
    broadcastState(io, room);

    if (room.gameId === "quip" && room.quip) {
      if (room.quip.phase === "writing" && writingComplete(room)) quipSeq = room.quip.seq;
      else if (room.quip.phase === "voting" && votingComplete(room)) quipSeq = room.quip.seq;
    } else if (room.phase === "question" && allConnectedAnswered(room)) {
      triviaSeq = room.phaseSeq;
    }
  });

  if (triviaSeq !== null) await advancePhase(io, code, { expectedSeq: triviaSeq });
  if (quipSeq !== null) await advanceQuip(io, code, { expectedSeq: quipSeq });
}
