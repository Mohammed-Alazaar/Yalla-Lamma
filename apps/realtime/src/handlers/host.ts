import {
  ERROR_CODES,
  generateRoomCode,
  hostCreateSchema,
  newId,
  type RoomState,
} from "@yalla/shared";
import { store } from "../store";
import { broadcastState, emitError } from "../lib/respond";
import { parsePayload } from "../lib/validate";
import type { AppServer, AppSocket } from "../lib/types";

const MAX_CODE_ATTEMPTS = 10;

export async function handleHostCreate(
  io: AppServer,
  socket: AppSocket,
  payload: unknown,
): Promise<void> {
  const data = parsePayload(socket, hostCreateSchema, payload);
  if (!data) return;

  const now = Date.now();
  const hostToken = newId();
  let code: string | null = null;

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const candidate = generateRoomCode();
    const room: RoomState = {
      code: candidate,
      hostSocketId: socket.id,
      hostToken,
      hostDisconnectedAt: null,
      vipPlayerId: null,
      players: {},
      sessions: {},
      phase: "lobby",
      prevPhase: null,
      phaseSeq: 0,
      locked: false,
      settings: {
        locale: data.locale,
        country: "General",
        category: "General",
        numQuestions: 10,
        timeLimitSec: 20,
      },
      questions: [],
      currentIndex: 0,
      currentQuestionStartedAt: 0,
      answers: {},
      createdAt: now,
      lastActivityAt: now,
    };
    if (await store.reserve(room)) {
      code = candidate;
      break;
    }
  }

  if (!code) {
    emitError(socket, ERROR_CODES.INTERNAL, "Could not allocate a room code");
    return;
  }

  socket.data.roomCode = code;
  socket.data.role = "host";
  await socket.join(code);

  socket.emit("host:token", { hostToken, roomCode: code });

  const room = await store.get(code);
  if (room) broadcastState(io, room);
}
