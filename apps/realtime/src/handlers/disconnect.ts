import { store, withRoomLock } from "../store";
import { broadcastState } from "../lib/respond";
import type { AppServer, AppSocket } from "../lib/types";
import { allConnectedAnswered } from "../game/engine";
import { advancePhase, pauseForHostDisconnect } from "../game/flow";

/**
 * Handle a dropped socket. Host drop → pause + grace countdown (RECON-4).
 * Player drop → mark disconnected; if that was the last outstanding answer of a
 * live question, end it early.
 */
export async function handleDisconnect(io: AppServer, socket: AppSocket): Promise<void> {
  const code = socket.data.roomCode;
  if (!code) return;

  if (socket.data.role === "host") {
    await pauseForHostDisconnect(io, code, socket.id);
    return;
  }

  let earlyEndSeq: number | null = null;
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

    if (room.phase === "question" && allConnectedAnswered(room)) {
      earlyEndSeq = room.phaseSeq;
    }
  });

  if (earlyEndSeq !== null) {
    await advancePhase(io, code, { expectedSeq: earlyEndSeq });
  }
}
