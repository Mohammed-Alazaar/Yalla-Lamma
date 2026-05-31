// FibParty (game #3) state types. A Fibbage-style bluffing game: write a
// believable lie for a fact-with-a-blank, then spot the truth among everyone's
// lies. Server holds `FibState` under `RoomState.fib`; clients get the redacted
// `PublicFibState` (per-viewer: own-lie marker + own reveal result).

export type FibPhase =
  | "writing" // players writing lies
  | "spotting" // players picking the truth
  | "reveal" // truth + scoring revealed
  | "leaderboard" // between questions
  | "final"; // last question — winner handled by the shell

export interface Fact {
  id: string;
  text: string; // contains the blank marker "___"
  truth: string;
  decoys: string[]; // 1-3 official decoys for small games
  category: string;
  difficulty: string;
  familyFriendly: boolean;
  locale: string;
}

export type FibOptionSource = "truth" | "player" | "decoy";

export interface FibAnswerOption {
  id: string; // stable id for this option
  text: string; // sanitized — a lie, the truth, or a decoy
  source: FibOptionSource;
  authorIds: string[]; // players who wrote this exact text (dupes merged); [] for truth/decoy
  voided?: boolean; // host-skipped
}

export interface FibQuestionState {
  factId: string;
  promptText: string; // contains the blank marker
  truthText: string;
  lies: Record<string, string>; // playerId -> their submitted lie (sanitized)
  options: FibAnswerOption[]; // assembled, shuffled list
  picks: Record<string, string>; // playerId -> chosen option id
  pickStartedAt: number; // epoch ms — speed scoring
  roundScores?: Record<string, FibViewerResult>; // per-player, set at reveal
}

export interface FibSettings {
  totalQuestions: number;
  category: string;
  lieTimeSec: number;
  spotTimeSec: number;
  familyFriendly: boolean;
}

export interface FibState {
  phase: FibPhase;
  questionIndex: number; // 0-based
  totalQuestions: number;
  settings: FibSettings;
  facts: Fact[]; // pre-selected at game start
  current: FibQuestionState;
  phaseEndsAt: number; // epoch ms — authoritative timing
  seq: number; // stale-timer guard
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const FIB_MIN_PLAYERS = 2; // FRANGE-1: truth is always in the list
export const FIB_MAX_PLAYERS = 12;
export const FIB_QUESTIONS_OPTIONS = [5, 8, 12] as const;
export const FIB_LIE_TIME_OPTIONS = [30, 45, 60] as const;
export const FIB_SPOT_TIME_OPTIONS = [20, 30] as const;
export const FIB_LIE_MIN = 1;
export const FIB_LIE_MAX = 60;
/** Minimum options shown when spotting (pad with decoys for tiny games). */
export const FIB_MIN_OPTIONS = 4;
/** The blank marker used in fact prompts. */
export const FIB_BLANK = "___";

/** Scoring (FREV-2/3/5). */
export const FIB_TRUTH_POINTS = 1000;
export const FIB_FOOL_POINTS = 500;
export const FIB_FINAL_MULTIPLIER = 2;

export const FIB_REVEAL_MS = 6_000;
export const FIB_LEADERBOARD_MS = 4_000;

export const DEFAULT_FIB_SETTINGS: FibSettings = {
  totalQuestions: 8,
  category: "General",
  lieTimeSec: 45,
  spotTimeSec: 30,
  familyFriendly: true,
};

// ─── Client-facing (redacted, per-viewer) views ──────────────────────────────

export interface PublicFibOption {
  id: string;
  text: string;
  /** True if the viewing player authored this lie (shown but not pickable). */
  isOwnLie: boolean;
  voided: boolean;
  // Reveal-only:
  source?: FibOptionSource;
  authorNames?: string[];
  pickCount?: number;
}

export interface FibViewerResult {
  foundTruth: boolean;
  truthPoints: number;
  fooled: number; // how many players picked the viewer's lie
  foolPoints: number;
}

export interface PublicFibState {
  phase: FibPhase;
  questionIndex: number;
  totalQuestions: number;
  phaseEndsAt: number;
  isFinalQuestion: boolean;
  promptText: string; // with the blank marker
  truthText: string | null; // null until reveal
  options: PublicFibOption[]; // empty during writing
  writingDone: string[]; // during writing
  pickedPlayerIds: string[]; // during spotting
  /** The viewer's own result, only at reveal (per-viewer). */
  viewerResult: FibViewerResult | null;
}

/**
 * Fooling points for one author: FIB_FOOL_POINTS per other player who picked
 * this lie, x2 on the final question (pure; FREV-3/5).
 */
export function foolingPoints(pickCount: number, isFinalQuestion: boolean): number {
  const base = pickCount * FIB_FOOL_POINTS;
  return isFinalQuestion ? base * FIB_FINAL_MULTIPLIER : base;
}
