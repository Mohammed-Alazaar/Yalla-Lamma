import { store, withRoomLock } from "../store";
import { broadcastState } from "../lib/respond";
import type { AppServer, AppSocket } from "../lib/types";

/**
 * Mark the host/player disconnected and broadcast. The full pause/grace and
 * graceful-end logic lands in Phase 6 (RECON-4); this is the baseline.
 */
export async function handleDisconnect(
  io: AppServer,
  socket: AppSocket,
): Promise<void> {
  const code = socket.data.roomCode;
  if (!code) return;

  await withRoomLock(code, async () => {
    const room = await store.get(code);
    if (!room) return;

    if (socket.data.role === "host" && room.hostSocketId === socket.id) {
      room.hostSocketId = null;
      room.hostDisconnectedAt = Date.now();
    } else if (socket.data.role === "player" && socket.data.playerId) {
      const player = room.players[socket.data.playerId];
      if (player) player.connected = false;
    }

    await store.save(room);
    broadcastState(io, room);
  });
}
