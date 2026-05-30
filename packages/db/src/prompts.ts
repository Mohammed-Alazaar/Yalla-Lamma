import type { QuipPrompt } from "@yalla/shared";
import { getPrisma, hasDatabase } from "./client";
import seedPromptsEn from "../data/prompts.en.json" with { type: "json" };
import seedPromptsAr from "../data/prompts.ar.json" with { type: "json" };

type SeedPrompt = { text: string; familyFriendly: boolean; category?: string };

/** Bundled prompts (used when no DATABASE_URL is configured — dev/tests). */
function bundledPrompts(): QuipPrompt[] {
  const en = (seedPromptsEn as SeedPrompt[]).map((p, i) => ({
    id: `prompt-en-${i}`,
    locale: "en",
    text: p.text,
    familyFriendly: p.familyFriendly,
    category: p.category,
  }));
  const ar = (seedPromptsAr as SeedPrompt[]).map((p, i) => ({
    id: `prompt-ar-${i}`,
    locale: "ar",
    text: p.text,
    familyFriendly: p.familyFriendly,
    category: p.category,
  }));
  return [...en, ...ar];
}

/**
 * Load the prompt pool for a locale (PB-4). When `familyFriendlyOnly`, restricts
 * to all-ages prompts (MOD-4 / QSET-4). Reads Postgres when configured, else the
 * bundled JSON.
 */
export async function loadPromptPool(
  locale: string,
  familyFriendlyOnly: boolean,
): Promise<QuipPrompt[]> {
  const ff = (p: { familyFriendly: boolean }) => !familyFriendlyOnly || p.familyFriendly;

  if (hasDatabase()) {
    const prisma = await getPrisma();
    const fetch = (loc: string) =>
      prisma.prompt.findMany({ where: { locale: loc, ...(familyFriendlyOnly ? { familyFriendly: true } : {}) } });
    let rows = await fetch(locale);
    // Arabic (and other locales) have no prompts yet — fall back to English so
    // QuipParty is still playable (PB-5: localized prompts are a v2 content drop).
    if (rows.length === 0 && locale !== "en") rows = await fetch("en");
    return rows.map((r) => ({
      id: r.id,
      locale: r.locale,
      text: r.text,
      familyFriendly: r.familyFriendly,
      category: r.category ?? undefined,
    }));
  }

  const all = bundledPrompts();
  let pool = all.filter((p) => p.locale === locale && ff(p));
  if (pool.length === 0 && locale !== "en") pool = all.filter((p) => p.locale === "en" && ff(p));
  return pool;
}

/** Pick `count` random, non-repeating prompts (PB-4). */
export function selectPrompts(pool: readonly QuipPrompt[], count: number): QuipPrompt[] {
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr.slice(0, Math.max(0, count));
}
