import type { Fact } from "@yalla/shared";
import { getPrisma, hasDatabase } from "./client";
import factsEn from "../data/facts.en.json" with { type: "json" };

type SeedFact = {
  text: string;
  truth: string;
  decoys: string[];
  category: string;
  difficulty: string;
  familyFriendly?: boolean;
};

function bundledFacts(): Fact[] {
  return (factsEn as SeedFact[]).map((f, i) => ({
    id: `fact-en-${i}`,
    locale: "en",
    text: f.text,
    truth: f.truth,
    decoys: f.decoys,
    category: f.category,
    difficulty: f.difficulty,
    familyFriendly: f.familyFriendly ?? true,
  }));
}

/**
 * Load the FibParty fact pool for a locale + category (FB-4). Falls back to
 * English when a locale has no facts (FB-6: Arabic facts are a v2 content drop).
 */
export async function loadFactPool(
  locale: string,
  category: string,
  familyFriendlyOnly: boolean,
): Promise<Fact[]> {
  if (hasDatabase()) {
    try {
      const prisma = await getPrisma();
      const fetch = (loc: string) =>
        prisma.fact.findMany({
          where: { locale: loc, category, ...(familyFriendlyOnly ? { familyFriendly: true } : {}) },
        });
      let rows = await fetch(locale);
      if (rows.length === 0 && locale !== "en") rows = await fetch("en");
      // DB reachable but the Fact table is empty (not seeded yet) → fall through
      // to the bundled facts so FibParty is playable immediately on deploy.
      if (rows.length > 0) {
        return rows.map((r) => ({
          id: r.id,
          locale: r.locale,
          text: r.text,
          truth: r.truth,
          decoys: r.decoys,
          category: r.category,
          difficulty: r.difficulty,
          familyFriendly: r.familyFriendly,
        }));
      }
    } catch (err) {
      // The Fact table may not be migrated yet — fall back to bundled facts.
      console.error("[facts] DB read failed; using bundled facts:", err);
    }
  }

  const all = bundledFacts();
  const match = (loc: string) =>
    all.filter(
      (f) => f.locale === loc && f.category === category && (!familyFriendlyOnly || f.familyFriendly),
    );
  let pool = match(locale);
  if (pool.length === 0 && locale !== "en") pool = match("en");
  return pool;
}

/** Pick `count` random, non-repeating facts (FB-4). */
export function selectFacts(pool: readonly Fact[], count: number): Fact[] {
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr.slice(0, Math.max(0, count));
}
