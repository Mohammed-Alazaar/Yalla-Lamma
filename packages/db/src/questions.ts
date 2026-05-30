import type { Question } from "@yalla/shared";
import { getPrisma, hasDatabase } from "./client";
import seedQuestions from "../data/questions.en.json" with { type: "json" };

type SeedQuestion = Omit<Question, "id">;

/** Bundled questions (used when no DATABASE_URL is configured — local dev/tests). */
function bundledQuestions(): Question[] {
  return (seedQuestions as SeedQuestion[]).map((q, i) => ({
    id: `seed-${q.locale}-${i}`,
    ...q,
  }));
}

/**
 * Load the full pool of questions for a locale + category (PRD QB-3/QB-7).
 * Reads from Postgres when configured, else from the bundled JSON.
 */
export async function loadQuestionPool(
  locale: string,
  category: string,
): Promise<Question[]> {
  if (hasDatabase()) {
    const rows = await getPrisma().question.findMany({
      where: { locale, category },
    });
    return rows.map((r) => ({
      id: r.id,
      locale: r.locale,
      text: r.text,
      choices: r.choices,
      correctIdx: r.correctIdx,
      category: r.category,
      difficulty: r.difficulty,
    }));
  }
  return bundledQuestions().filter(
    (q) => q.locale === locale && q.category === category,
  );
}
