// Core game-state types. The server holds the full `RoomState`; clients only
// ever receive a redacted `PublicRoomState` (see serialize.ts).

export type Locale = "en" | "ar";

export type Phase =
  | "lobby"
  | "question" // question shown, timer running
  | "reveal" // correct answer revealed
  | "leaderboard" // between-question scores
  | "final" // winner screen
  | "paused"; // host disconnected

export interface Player {
  id: string; // public, stable for the game
  name: string;
  color: string; // hex from PLAYER_COLORS
  score: number;
  connected: boolean;
  joinedAt: number; // epoch ms
}

export interface Question {
  id: string;
  text: string;
  choices: string[]; // length 4
  correctIdx: number; // 0..3 — NEVER sent to clients before reveal
  category: string;
  difficulty: string;
  locale: string;
}

export interface RoomSettings {
  locale: Locale;
  category: string;
  numQuestions: number;
  timeLimitSec: number;
}

export interface PlayerAnswer {
  choice: number; // 0..3
  submittedAt: number; // epoch ms
  pointsEarned: number; // computed server-side at submit
}

/**
 * Full server-side room state (persisted in Redis). Includes secrets
 * (`hostToken`, `sessions`) and answer keys that must never reach clients.
 */
export interface RoomState {
  code: string;
  hostSocketId: string | null;
  hostToken: string; // server-only — for host:rejoin
  hostDisconnectedAt: number | null; // when host dropped (for paused grace)
  vipPlayerId: string | null;
  players: Record<string, Player>;
  sessions: Record<string, string>; // server-only — sessionId -> playerId
  phase: Phase;
  prevPhase: Phase | null; // phase to resume after "paused"
  locked: boolean; // host locked the room (PRD ROOM-6)
  settings: RoomSettings;
  questions: Question[]; // pre-selected at game start
  currentIndex: number; // 0-based
  currentQuestionStartedAt: number; // epoch ms; authoritative timing
  // questionId -> playerId -> answer
  answers: Record<string, Record<string, PlayerAnswer>>;
  createdAt: number;
  lastActivityAt: number;
}

// ─── Client-facing (redacted) view ──────────────────────────────────────────

export interface PublicPlayer {
  id: string;
  name: string;
  color: string;
  score: number;
  connected: boolean;
  isVip: boolean;
}

export interface PublicQuestion {
  id: string;
  index: number; // 0-based
  total: number;
  text: string;
  choices: string[];
  category: string;
  isFinal: boolean;
  /** Correct choice — only populated from the `reveal` phase onward. */
  correctIdx: number | null;
}

export interface PlayerResult {
  playerId: string;
  choice: number | null; // null = did not answer
  correct: boolean;
  pointsEarned: number;
}

export interface PublicRoomState {
  code: string;
  phase: Phase;
  settings: RoomSettings;
  players: PublicPlayer[]; // sorted by joinedAt
  hostConnected: boolean;
  vipPlayerId: string | null;
  locked: boolean;
  /** Current question (text/choices); null in lobby/final. */
  question: PublicQuestion | null;
  /** Authoritative question start (epoch ms) for client-side countdown. */
  questionStartedAt: number | null;
  /** Player ids that have locked an answer for the current question. */
  answeredPlayerIds: string[];
  /** Per-player result for the current question — only from `reveal` onward. */
  results: PlayerResult[] | null;
}
