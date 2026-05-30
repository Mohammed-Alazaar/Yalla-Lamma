import { PLAYER_COLORS } from "./constants";

/**
 * Pick a color not already used in the room (PRD LOB-5 — no duplicates).
 * The palette length equals MAX_PLAYERS, so a free color always exists until
 * the room is full; falls back to the full palette defensively.
 */
export function pickAvailableColor(takenColors: readonly string[]): string {
  const taken = new Set(takenColors);
  const free = PLAYER_COLORS.filter((c) => !taken.has(c));
  const pool = free.length > 0 ? free : PLAYER_COLORS;
  return pool[Math.floor(Math.random() * pool.length)]!;
}
