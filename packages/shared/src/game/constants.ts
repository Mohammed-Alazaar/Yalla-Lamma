// Fixed constants shared by the web app and realtime server.

/** Room-code alphabet — excludes I, O, 0, 1 to avoid confusion (PRD ROOM-1). */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export const ROOM_CODE_LENGTH = 4;

/** Active-player cap per room (PRD ROOM-8). */
export const MAX_PLAYERS = 12;
/** Minimum players before the VIP can start (PRD LOB-4). */
export const MIN_PLAYERS_TO_START = 2;

/** Room expires this long after the last activity (PRD ROOM-3). */
export const ROOM_TTL_SECONDS = 30 * 60;
/** Reconnection grace window for players and host (PRD RECON-2 / RECON-4). */
export const RECONNECT_GRACE_MS = 60_000;

/** Display-name length bounds (PRD ROOM-4). */
export const NAME_MIN_LENGTH = 1;
export const NAME_MAX_LENGTH = 20;

/** Fixed player-color palette; assigned without duplicates per room (PRD LOB-5). */
export const PLAYER_COLORS = [
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#22C55E", // green
  "#14B8A6", // teal
  "#06B6D4", // cyan
  "#3B82F6", // blue
  "#6366F1", // indigo
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#F43F5E", // rose
  "#A3A3A3", // neutral
] as const;

/** Configurable game settings options (PRD LOB-3). */
export const NUM_QUESTIONS_OPTIONS = [5, 10, 15, 20] as const;
export const TIME_LIMIT_OPTIONS = [10, 20, 30, 60] as const;
export const CATEGORIES = [
  "General",
  "Science",
  "History",
  "Pop Culture",
  "Sports",
] as const;

/** Between-question leaderboard duration (PRD GAME-6). */
export const LEADERBOARD_MS = 5_000;
/** Reveal duration before the leaderboard. */
export const REVEAL_MS = 4_000;

/** Scoring (PRD GAME-4 / GAME-7 / §16.2). */
export const BASE_SCORE = 500;
export const MAX_SPEED_BONUS = 500;
export const FINAL_QUESTION_MULTIPLIER = 2;

/**
 * Slack past the nominal time limit during which a late-arriving answer (e.g. a
 * buzzer-beater auto-submitted by a phone right as its countdown hits 0) is
 * still accepted with a 0 speed bonus. The server holds the question open this
 * long before revealing so those submissions land. Covers network latency +
 * client/server clock skew.
 */
export const ANSWER_GRACE_MS = 750;

export type CategoryName = (typeof CATEGORIES)[number];
