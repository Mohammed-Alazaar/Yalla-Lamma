import type { QuipPrompt } from "@yalla/shared";
import { getPrisma, hasDatabase } from "./client";
import seedPromptsEn from "../data/prompts.en.json" with { type: "json" };

type SeedPrompt = { text: string; familyFriendly: boolean; category?: string; locale?: string };

/** Bundled prompts (used when no DATABASE_URL is configured — dev/tests). */
function bundledPrompts(): QuipPrompt[] {
  return (seedPromptsEn as SeedPrompt[]).map((p, i) => ({
    id: `prompt-en-${i}`,
    locale: p.locale ?? "en",
    text: p.text,
    familyFriendly: p.familyFriendly,
    category: p.category,
  }));
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
  if (hasDatabase()) {
    const prisma = await getPrisma();
    const rows = await prisma.prompt.findMany({
      where: { locale, ...(familyFriendlyOnly ? { familyFriendly: true } : {}) },
    });
    return rows.map((r) => ({
      id: r.id,
      locale: r.locale,
      text: r.text,
      familyFriendly: r.familyFriendly,
      category: r.category ?? undefined,
    }));
  }
  return bundledPrompts().filter(
    (p) => p.locale === locale && (!familyFriendlyOnly || p.familyFriendly),
  );
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
