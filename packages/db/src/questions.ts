import type { Question } from "@yalla/shared";
import { getPrisma, hasDatabase } from "./client";
import seedEn from "../data/questions.en.json" with { type: "json" };
import seedAr from "../data/questions.ar.json" with { type: "json" };
import seedAlgeria from "../data/questions.algeria.json" with { type: "json" };
import seedPalestine from "../data/questions.palestine.json" with { type: "json" };
import seedSyria from "../data/questions.syria.json" with { type: "json" };

type SeedQuestion = Omit<Question, "id" | "country"> & { country?: string };

/** Bundled questions (used when no DATABASE_URL is configured — local dev/tests). */
function bundledQuestions(): Question[] {
  const all = [
    ...(seedEn as SeedQuestion[]),
    ...(seedAr as SeedQuestion[]),
    ...(seedAlgeria as SeedQuestion[]),
    ...(seedPalestine as SeedQuestion[]),
    ...(seedSyria as SeedQuestion[]),
  ];
  return all.map((q, i) => ({ id: `seed-${i}`, country: "General", ...q }));
}

/**
 * Load the question pool for a locale + country + category (PRD QB-3/QB-7).
 * "General" is the locale-specific generic bank; a specific country serves its
 * own (Arabic) bank regardless of UI language. Reads Postgres when configured,
 * else the bundled JSON.
 */
export async function loadQuestionPool(
  locale: string,
  country: string,
  category: string,
): Promise<Question[]> {
  const isGeneral = country === "General";

  if (hasDatabase()) {
    const prisma = await getPrisma();
    const rows = await prisma.question.findMany({
      where: { category, country, ...(isGeneral ? { locale } : {}) },
    });
    return rows.map((r) => ({
      id: r.id,
      locale: r.locale,
      text: r.text,
      choices: r.choices,
      correctIdx: r.correctIdx,
      category: r.category,
      country: r.country,
      difficulty: r.difficulty,
    }));
  }

  return bundledQuestions().filter(
    (q) =>
      q.category === category &&
      q.country === country &&
      (!isGeneral || q.locale === locale),
  );
}
