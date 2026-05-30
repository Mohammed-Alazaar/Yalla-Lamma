import type { QuipPrompt } from "@yalla/shared";

export interface PromptAssignment {
  /** playerId -> the prompt ids that player must answer (exactly 2). */
  assignments: Record<string, string[]>;
  /** The n prompts used this round, in matchup order. */
  prompts: QuipPrompt[];
  /** Each prompt's two distinct authors (becomes a head-to-head matchup). */
  pairs: { promptId: string; authorIds: [string, string] }[];
}

/**
 * Assign prompts so every player answers exactly 2 and every prompt is answered
 * by exactly 2 distinct players (PRD §8). Circle method: with players arranged
 * in a circle, prompt_i goes to player_i and player_(i+1). Works for any n ≥ 3
 * (odd or even). The round offset rotates the circle so neighbours vary.
 *
 * Pure and deterministic given (playerIds, prompts, round) — the caller shuffles
 * the prompt pool beforehand for content variety.
 */
export function assignPrompts(
  playerIds: string[],
  prompts: QuipPrompt[],
  round: number,
): PromptAssignment {
  const n = playerIds.length;
  if (n < 3) throw new Error("QuipParty needs at least 3 players");
  if (prompts.length < n) throw new Error(`Need at least ${n} prompts, got ${prompts.length}`);

  const chosen = prompts.slice(0, n);
  // Round-robin rotation: fix the first player and rotate the rest each round,
  // so circle adjacencies (and thus matchups) actually change between rounds —
  // a plain whole-circle rotation would keep the same neighbour set.
  const rest = playerIds.slice(1);
  const offset = (((round - 1) % rest.length) + rest.length) % rest.length;
  const rotated = rest.map((_, i) => rest[(i + offset) % rest.length]!);
  const seat = [playerIds[0]!, ...rotated];

  const assignments: Record<string, string[]> = {};
  for (const id of playerIds) assignments[id] = [];

  const pairs: { promptId: string; authorIds: [string, string] }[] = [];
  for (let i = 0; i < n; i++) {
    const a = seat[i]!;
    const b = seat[(i + 1) % n]!;
    const promptId = chosen[i]!.id;
    assignments[a]!.push(promptId);
    assignments[b]!.push(promptId);
    pairs.push({ promptId, authorIds: [a, b] });
  }

  return { assignments, prompts: chosen, pairs };
}
