import { resolve } from "node:path";
import { config } from "dotenv";
import { getPrisma } from "./client";
import { importFromFile } from "./import";

config({ path: resolve(process.cwd(), "../../.env"), quiet: true });
config({ quiet: true });

/** Seed the question bank from the bundled English + Arabic sets (PRD QB-1). */
async function main(): Promise<void> {
  const enFile = resolve(import.meta.dirname, "../data/questions.en.json");
  const arFile = resolve(import.meta.dirname, "../data/questions.ar.json");
  const prisma = await getPrisma();

  // Idempotent: clear the en/ar banks before re-seeding.
  const deleted = await prisma.question.deleteMany({ where: { locale: { in: ["en", "ar"] } } });
  if (deleted.count > 0) console.log(`Cleared ${deleted.count} existing questions.`);

  const en = await importFromFile(enFile);
  console.log(`Seeded ${en} English questions.`);
  const ar = await importFromFile(arFile);
  console.log(`Seeded ${ar} Arabic questions.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
