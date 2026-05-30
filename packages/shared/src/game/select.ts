import type { Question } from "./types";

/** Fisher–Yates shuffle (returns a new array). */
function shuffle<T>(input: readonly T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Pick `count` random, non-repeating questions from the pool (PRD QB-3 / QB-4).
 * Returns fewer than `count` only if the pool is smaller.
 */
export function selectQuestions(pool: readonly Question[], count: number): Question[] {
  return shuffle(pool).slice(0, Math.max(0, count));
}
