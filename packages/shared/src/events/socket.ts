import type { PublicRoomState } from "../game/types";
import type { ErrorCode } from "./schemas";
import type {
  HostCreatePayload,
  HostKickPayload,
  HostLockPayload,
  HostRejoinPayload,
  HostSkipAnswerPayload,
  PlayerAnswerPayload,
  PlayerJoinPayload,
  PlayerRejoinPayload,
  QuipSubmitAnswerPayload,
  QuipVotePayload,
  VipConfigurePayload,
  VipConfigureQuipPayload,
  VipSelectGamePayload,
} from "./schemas";

export interface SocketError {
  code: ErrorCode;
  message: string;
}

export interface HostTokenPayload {
  hostToken: string;
  roomCode: string;
}

export interface PlayerSessionPayload {
  sessionId: string;
  playerId: string;
}

export interface QuipAnswerRejectedPayload {
  promptId: string;
  reason: "profanity" | "tooLong" | "empty";
}

/** Events the server emits to clients (PRD §8.2). */
export interface ServerToClientEvents {
  state: (state: PublicRoomState) => void;
  error: (payload: SocketError) => void;
  kicked: () => void;
  "host:token": (payload: HostTokenPayload) => void;
  "player:session": (payload: PlayerSessionPayload) => void;
  "quip:answerRejected": (payload: QuipAnswerRejectedPayload) => void;
}

/** Events clients emit to the server (PRD §8.1). */
export interface ClientToServerEvents {
  "host:create": (payload: HostCreatePayload) => void;
  "host:rejoin": (payload: HostRejoinPayload) => void;
  "player:join": (payload: PlayerJoinPayload) => void;
  "player:rejoin": (payload: PlayerRejoinPayload) => void;
  "vip:selectGame": (payload: VipSelectGamePayload) => void;
  "vip:configure": (payload: VipConfigurePayload) => void;
  "vip:configureQuip": (payload: VipConfigureQuipPayload) => void;
  "vip:start": () => void;
  "vip:next": () => void;
  "vip:playAgain": () => void;
  "vip:changeGame": () => void;
  "player:answer": (payload: PlayerAnswerPayload) => void;
  "quip:submitAnswer": (payload: QuipSubmitAnswerPayload) => void;
  "quip:vote": (payload: QuipVotePayload) => void;
  "host:kick": (payload: HostKickPayload) => void;
  "host:lock": (payload: HostLockPayload) => void;
  "host:skipAnswer": (payload: HostSkipAnswerPayload) => void;
}

/** Per-socket data attached server-side after auth/join. */
export interface SocketData {
  roomCode?: string;
  role?: "host" | "player";
  playerId?: string;
}

export type InterServerEvents = Record<string, never>;
