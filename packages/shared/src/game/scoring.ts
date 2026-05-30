import { BASE_SCORE, FINAL_QUESTION_MULTIPLIER, MAX_SPEED_BONUS } from "./constants";

export interface ScoreInput {
  isCorrect: boolean;
  /** Milliseconds between the question start and this submission. */
  msSinceQuestionStart: number;
  timeLimitSec: number;
  isFinalQuestion: boolean;
}

/**
 * Points for one answer (PRD §16.2 / GAME-4 / GAME-7). Wrong = 0. Correct =
 * base 500 + a speed bonus that decays linearly 500→0 over the timer. The final
 * question is worth double. Never negative.
 */
export function scoreAnswer(opts: ScoreInput): number {
  if (!opts.isCorrect) return 0;
  const timeLimitMs = opts.timeLimitSec * 1000;
  const fraction = Math.max(0, 1 - opts.msSinceQuestionStart / timeLimitMs);
  const speedBonus = Math.round(MAX_SPEED_BONUS * fraction);
  const total = BASE_SCORE + speedBonus;
  return opts.isFinalQuestion ? total * FINAL_QUESTION_MULTIPLIER : total;
}
