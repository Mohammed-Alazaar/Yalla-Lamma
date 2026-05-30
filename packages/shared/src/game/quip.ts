// QuipParty (game #2) state types. Server holds `QuipState` under
// `RoomState.quip`; clients receive the redacted `PublicQuipState`.

export type QuipPhase =
  | "writing" // players typing answers
  | "voting" // a matchup is up for votes
  | "reveal" // votes revealed, points awarded
  | "leaderboard" // between matchups
  | "final"; // last matchup done — shell shows the winner

export interface QuipPrompt {
  id: string;
  text: string;
  locale: string;
  familyFriendly: boolean;
  category?: string;
}

export interface QuipAnswer {
  promptId: string;
  authorId: string; // player id
  text: string; // sanitized
  isSafetyAnswer: boolean; // auto-filled placeholder on timeout
}

export interface QuipMatchup {
  promptId: string;
  promptText: string;
  answers: [QuipAnswer, QuipAnswer]; // exactly two
  votes: Record<string, 0 | 1>; // voterId -> which answer
  audienceVotes?: [number, number]; // aggregated counts if enabled
  voided?: boolean; // host skipped it
  pointsEarned?: [number, number]; // awarded to each author at reveal
}

export interface QuipSettings {
  totalRounds: number;
  answerTimeSec: number;
  voteTimeSec: number;
  familyFriendly: boolean;
  audienceVoting: boolean;
}

/** Player bounds for QuipParty (PA-4: 3–12). */
export const QUIP_MIN_PLAYERS = 3;
export const QUIP_MAX_PLAYERS = 12;

/** VIP-configurable option lists + defaults (QSET-1..5). */
export const QUIP_ROUNDS_OPTIONS = [2, 3] as const;
export const QUIP_ANSWER_TIME_OPTIONS = [60, 90, 120] as const;
export const QUIP_VOTE_TIME_OPTIONS = [15, 20, 30] as const;
/** Answer length bounds (ANS-2). */
export const QUIP_ANSWER_MIN = 1;
export const QUIP_ANSWER_MAX = 80;

export const DEFAULT_QUIP_SETTINGS: QuipSettings = {
  totalRounds: 3,
  answerTimeSec: 90,
  voteTimeSec: 20,
  familyFriendly: true,
  audienceVoting: true,
};

/** Scoring (REV-2/REV-3): pool split by vote share, +bonus on a clean sweep. */
export const QUIP_POOL_BASE = 1000;
export const QUIP_QUIPLASH_BONUS = 250;
export const QUIP_FINAL_MULTIPLIER = 2;
/** Reveal + between-matchup leaderboard durations. */
export const QUIP_REVEAL_MS = 5_000;
export const QUIP_LEADERBOARD_MS = 4_000;
/** Audience votes count for at most this fraction of the player vote weight (AUD-1). */
export const QUIP_AUDIENCE_WEIGHT_CAP = 0.5;

/** Canned placeholders auto-submitted when a player runs out of time (PA-5). */
export const QUIP_SAFETY_ANSWERS = [
  "(no comment)",
  "My dog ate my answer",
  "I plead the fifth",
  "...awkward silence...",
  "Error 404: joke not found",
  "Ask me later",
] as const;

/**
 * Points for one matchup (pure; REV-2/REV-3). The pool is split proportionally
 * by vote share between the two authors; a clean sweep adds a Quiplash bonus to
 * the winner; the final round doubles the pool. Safety (auto-filled) answers
 * never earn points. Voided (host-skipped) matchups score nothing.
 */
export function scoreQuipMatchup(opts: {
  votes: [number, number];
  isSafety: [boolean, boolean];
  voided: boolean;
  isFinalRound: boolean;
}): [number, number] {
  if (opts.voided) return [0, 0];
  const total = opts.votes[0] + opts.votes[1];
  if (total === 0) return [0, 0];

  const pool = QUIP_POOL_BASE * (opts.isFinalRound ? QUIP_FINAL_MULTIPLIER : 1);
  let p0 = opts.isSafety[0] ? 0 : Math.round((pool * opts.votes[0]) / total);
  let p1 = opts.isSafety[1] ? 0 : Math.round((pool * opts.votes[1]) / total);
  // Quiplash! clean-sweep bonus for a real answer that took every vote.
  if (opts.votes[1] === 0 && !opts.isSafety[0]) p0 += QUIP_QUIPLASH_BONUS;
  if (opts.votes[0] === 0 && !opts.isSafety[1]) p1 += QUIP_QUIPLASH_BONUS;
  return [p0, p1];
}

export interface QuipState {
  phase: QuipPhase;
  round: number; // 1-based
  totalRounds: number;
  settings: QuipSettings;
  reserved: QuipPrompt[]; // all prompts reserved for the game (sliced per round)
  prompts: QuipPrompt[]; // prompts drawn for the current round
  assignments: Record<string, string[]>; // playerId -> promptIds (this round)
  submitted: Record<string, QuipAnswer[]>; // playerId -> their answers
  matchups: QuipMatchup[]; // built once all answers are in
  currentMatchup: number; // index into matchups
  phaseEndsAt: number; // epoch ms — authoritative, for client countdown
  seq: number; // transition guard for stale auto-advance timers
}

// ─── Client-facing (redacted) views ──────────────────────────────────────────

export interface PublicQuipMatchup {
  promptText: string;
  /** The two answer texts (left/right). Vote counts hidden until reveal. */
  answers: [string, string];
  /** Author player ids — clients use this only to exclude authors from voting. */
  authorIds: [string, string];
  isSafety: [boolean, boolean];
  voteCounts: [number, number] | null; // null until reveal
  pointsEarned: [number, number] | null; // null until reveal
  voided: boolean;
}

export interface PublicQuipState {
  phase: QuipPhase;
  round: number;
  totalRounds: number;
  phaseEndsAt: number;
  isFinalRound: boolean;
  /** Prompts each player must answer this round, by player id (writing phase). */
  assignments: Record<string, string[]>;
  /** promptId -> prompt text for this round (so phones can show their prompts). */
  promptTexts: Record<string, string>;
  /** Players who have submitted every assigned answer (writing phase). */
  writingDone: string[];
  matchup: PublicQuipMatchup | null;
  matchupIndex: number;
  matchupTotal: number;
  /** Voter ids that have voted on the current matchup. */
  votedPlayerIds: string[];
}
