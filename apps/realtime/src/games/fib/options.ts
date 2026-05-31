// Pure answer-list assembly for FibParty (PRD-game3 §8). Builds the shuffled
// option list from all player lies + the one truth, handling truth-collisions,
// duplicate merges, and decoy padding for tiny games.

import { FIB_MIN_OPTIONS, type FibAnswerOption } from "@yalla/shared";

/** Normalize for comparison: trim, collapse whitespace, lowercase. */
export function normalizeAnswer(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Assemble the shuffled option list: the truth + one option per unique player
 * lie (duplicates merged, crediting all authors), padded with unused decoys to
 * at least `minOptions`. Lies equal to the truth are dropped (safety net for
 * FLIE-5). Submissions auto-assigned on timeout (`autoFilledIds`) appear as
 * authorless decoys so a no-show earns no fooling credit. Each option gets a
 * stable id.
 */
export function assembleOptions(
  truth: string,
  decoys: readonly string[],
  lies: Record<string, string>,
  autoFilledIds: ReadonlySet<string> = new Set(),
  minOptions: number = FIB_MIN_OPTIONS,
): FibAnswerOption[] {
  const truthNorm = normalizeAnswer(truth);

  // Group authored player lies by normalized text (first casing wins; merge
  // authors). Auto-filled submissions are collected separately as decoys.
  const byNorm = new Map<string, { text: string; authors: string[] }>();
  const autoNorm = new Map<string, string>();
  for (const [playerId, lie] of Object.entries(lies)) {
    const norm = normalizeAnswer(lie);
    if (!norm || norm === truthNorm) continue; // drop empty or truth-collisions
    if (autoFilledIds.has(playerId)) {
      if (!byNorm.has(norm) && !autoNorm.has(norm)) autoNorm.set(norm, lie.trim());
      continue;
    }
    const existing = byNorm.get(norm);
    if (existing) existing.authors.push(playerId);
    else byNorm.set(norm, { text: lie.trim(), authors: [playerId] });
  }

  const options: Omit<FibAnswerOption, "id">[] = [
    { text: truth.trim(), source: "truth", authorIds: [] },
  ];
  for (const { text, authors } of byNorm.values()) {
    options.push({ text, source: "player", authorIds: authors });
  }
  for (const text of autoNorm.values()) {
    options.push({ text, source: "decoy", authorIds: [] });
  }

  // Pad with unused decoys (not equal to the truth or any lie) up to minOptions.
  const used = new Set<string>([truthNorm, ...byNorm.keys(), ...autoNorm.keys()]);
  for (const decoy of decoys) {
    if (options.length >= minOptions) break;
    const norm = normalizeAnswer(decoy);
    if (!norm || used.has(norm)) continue;
    used.add(norm);
    options.push({ text: decoy.trim(), source: "decoy", authorIds: [] });
  }

  return shuffle(options).map((o, i) => ({ id: `opt-${i}`, ...o }));
}
