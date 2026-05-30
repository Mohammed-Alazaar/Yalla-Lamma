import { resolve } from "node:path";
import { config } from "dotenv";
import { getPrisma } from "./client";
import { importFromFile } from "./import";

config({ path: resolve(process.cwd(), "../../.env"), quiet: true });
config({ quiet: true });

/** Seed the question bank from the bundled English set (PRD QB-1: 200+ questions). */
async function main(): Promise<void> {
  const dataFile = resolve(import.meta.dirname, "../data/questions.en.json");
  const prisma = await getPrisma();

  // Idempotent: clear the English bank before re-seeding.
  const deleted = await prisma.question.deleteMany({ where: { locale: "en" } });
  if (deleted.count > 0) console.log(`Cleared ${deleted.count} existing en questions.`);

  const imported = await importFromFile(dataFile);
  console.log(`Seeded ${imported} English questions.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
