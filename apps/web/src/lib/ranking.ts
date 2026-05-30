import type { PublicPlayer } from "@yalla/shared";

export interface RankedPlayer extends PublicPlayer {
  rank: number; // 1-based; ties share a rank
}

/**
 * Rank players by score (desc), ties broken by name — mirrors the server's
 * `standings` so the host and players show a consistent order.
 */
export function rankPlayers(players: PublicPlayer[]): RankedPlayer[] {
  const sorted = [...players].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name),
  );
  let lastScore = Number.POSITIVE_INFINITY;
  let lastRank = 0;
  return sorted.map((p, i) => {
    const rank = p.score === lastScore ? lastRank : i + 1;
    lastScore = p.score;
    lastRank = rank;
    return { ...p, rank };
  });
}
