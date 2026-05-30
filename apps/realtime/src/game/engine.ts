// Pure game engine: deterministic state transitions over a RoomState. No I/O,
// no timers, no sockets — every function takes `now` explicitly so it can be
// unit-tested. The realtime flow layer (flow.ts) wraps these with the room
// lock, persistence, timers, and broadcasts.

import {
  ANSWER_GRACE_MS,
  scoreAnswer,
  type Player,
  type Question,
  type RoomState,
} from "@yalla/shared";

export type AnswerRejection =
  | "wrong_phase"
  | "wrong_question"
  | "no_player"
  | "duplicate"
  | "too_late";

export type AnswerOutcome =
  | { accepted: true; isCorrect: boolean; pointsEarned: number }
  | { accepted: false; reason: AnswerRejection };

export function currentQuestion(room: RoomState): Question | null {
  return room.questions[room.currentIndex] ?? null;
}

export function isFinalQuestion(room: RoomState): boolean {
  return room.questions.length > 0 && room.currentIndex === room.questions.length - 1;
}

/** Begin a fresh game: assign questions, reset scores, open the first question. */
export function startGame(room: RoomState, questions: Question[], now: number): void {
  room.questions = questions;
  room.currentIndex = 0;
  room.answers = {};
  for (const player of Object.values(room.players)) player.score = 0;
  room.phase = "question";
  room.currentQuestionStartedAt = now;
}

/**
 * Record one player's answer (server-authoritative). Rejects on wrong phase,
 * stale/duplicate submissions, unknown player, or submissions past the timer
 * (PRD GAME-3). Scores correct answers via {@link scoreAnswer} and adds to the
 * running total.
 */
export function recordAnswer(
  room: RoomState,
  playerId: string,
  questionId: string,
  choice: number,
  now: number,
): AnswerOutcome {
  if (room.phase !== "question") return { accepted: false, reason: "wrong_phase" };

  const question = currentQuestion(room);
  if (!question || question.id !== questionId) {
    return { accepted: false, reason: "wrong_question" };
  }

  const player = room.players[playerId];
  if (!player) return { accepted: false, reason: "no_player" };

  const answersForQuestion = (room.answers[question.id] ??= {});
  if (answersForQuestion[playerId]) return { accepted: false, reason: "duplicate" };

  const elapsed = now - room.currentQuestionStartedAt;
  const timeLimitMs = room.settings.timeLimitSec * 1000;
  // Accept buzzer-beaters within the grace window; the speed bonus is already
  // clamped to 0 once `elapsed` exceeds the nominal limit.
  if (elapsed > timeLimitMs + ANSWER_GRACE_MS) return { accepted: false, reason: "too_late" };

  const isCorrect = choice === question.correctIdx;
  const pointsEarned = scoreAnswer({
    isCorrect,
    msSinceQuestionStart: Math.max(0, elapsed),
    timeLimitSec: room.settings.timeLimitSec,
    isFinalQuestion: isFinalQuestion(room),
  });

  answersForQuestion[playerId] = { choice, submittedAt: now, pointsEarned };
  player.score += pointsEarned;
  return { accepted: true, isCorrect, pointsEarned };
}

/**
 * Whether every *connected* player has locked an answer for the current
 * question — lets the server end the question early (disconnected players who
 * never answered score 0, RECON-3). False when nobody is connected.
 */
export function allConnectedAnswered(room: RoomState): boolean {
  const question = currentQuestion(room);
  if (!question) return false;
  const connected = Object.values(room.players).filter((p) => p.connected);
  if (connected.length === 0) return false;
  const answers = room.answers[question.id] ?? {};
  return connected.every((p) => Boolean(answers[p.id]));
}

/** question → reveal (lock answers, expose the correct choice). */
export function revealAnswer(room: RoomState): void {
  room.phase = "reveal";
}

/** reveal → leaderboard. */
export function showLeaderboard(room: RoomState): void {
  room.phase = "leaderboard";
}

/**
 * leaderboard → next question, or → final after the last one (PRD GAME-6).
 * Returns whether the game has finished.
 */
export function advanceQuestion(room: RoomState, now: number): { finished: boolean } {
  if (isFinalQuestion(room)) {
    room.phase = "final";
    return { finished: true };
  }
  room.currentIndex += 1;
  room.phase = "question";
  room.currentQuestionStartedAt = now;
  return { finished: false };
}

/** final → lobby with scores cleared, keeping the same players (PRD GAME-9). */
export function resetForReplay(room: RoomState): void {
  room.phase = "lobby";
  room.questions = [];
  room.currentIndex = 0;
  room.currentQuestionStartedAt = 0;
  room.answers = {};
  room.quip = null; // clear quip state too; gameId is kept for "play again"
  for (const player of Object.values(room.players)) player.score = 0;
}

export interface Standing {
  playerId: string;
  name: string;
  color: string;
  score: number;
  rank: number; // 1-based; ties share a rank
}

/** Players ranked by score (desc), ties broken by name for stable ordering. */
export function standings(room: RoomState): Standing[] {
  const sorted = Object.values(room.players)
    .slice()
    .sort((a: Player, b: Player) => b.score - a.score || a.name.localeCompare(b.name));

  const result: Standing[] = [];
  let lastScore = Number.POSITIVE_INFINITY;
  let lastRank = 0;
  sorted.forEach((p, i) => {
    const rank = p.score === lastScore ? lastRank : i + 1;
    lastScore = p.score;
    lastRank = rank;
    result.push({ playerId: p.id, name: p.name, color: p.color, score: p.score, rank });
  });
  return result;
}
