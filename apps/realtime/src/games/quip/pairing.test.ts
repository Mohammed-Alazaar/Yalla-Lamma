import { describe, expect, test } from "vitest";
import type { QuipPrompt } from "@yalla/shared";
import { assignPrompts } from "./pairing";

const prompts = (count: number): QuipPrompt[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `prompt-${i}`,
    text: `Prompt ${i}`,
    locale: "en",
    familyFriendly: true,
  }));

const players = (n: number): string[] => Array.from({ length: n }, (_, i) => `p${i}`);

describe("assignPrompts", () => {
  for (const n of [3, 4, 5, 8, 12]) {
    test(`n=${n}: each player gets 2 prompts, each prompt has 2 distinct authors`, () => {
      const ids = players(n);
      const { assignments, pairs } = assignPrompts(ids, prompts(n), 1);

      // Every player answers exactly 2 prompts.
      for (const id of ids) expect(assignments[id]).toHaveLength(2);

      // Every prompt has exactly 2 distinct authors; no self-pairing.
      expect(pairs).toHaveLength(n);
      const authorsPerPrompt: Record<string, string[]> = {};
      for (const id of ids) {
        for (const promptId of assignments[id]!) {
          (authorsPerPrompt[promptId] ??= []).push(id);
        }
      }
      expect(Object.keys(authorsPerPrompt)).toHaveLength(n);
      for (const authors of Object.values(authorsPerPrompt)) {
        expect(authors).toHaveLength(2);
        expect(authors[0]).not.toBe(authors[1]); // no self-pairing
      }
      for (const { authorIds } of pairs) expect(authorIds[0]).not.toBe(authorIds[1]);
    });
  }

  test("rotates neighbours across rounds (varied matchups)", () => {
    const ids = players(5);
    const r1 = assignPrompts(ids, prompts(5), 1).pairs.map((p) => p.authorIds.slice().sort().join("|"));
    const r2 = assignPrompts(ids, prompts(5), 2).pairs.map((p) => p.authorIds.slice().sort().join("|"));
    // At least some pairings differ between rounds.
    expect(r1.some((pair) => !r2.includes(pair))).toBe(true);
  });

  test("rejects fewer than 3 players", () => {
    expect(() => assignPrompts(players(2), prompts(2), 1)).toThrow(/at least 3/);
  });

  test("rejects too few prompts", () => {
    expect(() => assignPrompts(players(5), prompts(4), 1)).toThrow(/at least 5 prompts/);
  });
});
