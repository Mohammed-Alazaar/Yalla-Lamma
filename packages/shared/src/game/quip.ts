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

export interface QuipState {
  phase: QuipPhase;
  round: number; // 1-based
  totalRounds: number;
  settings: QuipSettings;
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
  /** Prompts each player still needs to answer (writing phase). */
  assignments: Record<string, string[]>;
  /** Players who have submitted every assigned answer (writing phase). */
  writingDone: string[];
  matchup: PublicQuipMatchup | null;
  matchupIndex: number;
  matchupTotal: number;
  /** Voter ids that have voted on the current matchup. */
  votedPlayerIds: string[];
}
