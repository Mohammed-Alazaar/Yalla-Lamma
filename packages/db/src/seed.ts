import { resolve } from "node:path";
import { config } from "dotenv";
import { getPrisma } from "./client";
import { importFromFile, importPromptsFromFile } from "./import";

config({ path: resolve(process.cwd(), "../../.env"), quiet: true });
config({ quiet: true });

/** Seed the question bank from the bundled generic + country sets (PRD QB-1). */
async function main(): Promise<void> {
  const dir = resolve(import.meta.dirname, "../data");
  const files = [
    "questions.en.json",
    "questions.ar.json",
    "questions.algeria.json",
    "questions.palestine.json",
    "questions.syria.json",
  ];
  const prisma = await getPrisma();

  // Idempotent: clear the bank before re-seeding.
  const deleted = await prisma.question.deleteMany({});
  if (deleted.count > 0) console.log(`Cleared ${deleted.count} existing questions.`);

  let total = 0;
  for (const file of files) {
    const n = await importFromFile(resolve(dir, file));
    console.log(`Seeded ${n} from ${file}.`);
    total += n;
  }
  console.log(`Seeded ${total} questions in total.`);

  // QuipParty prompts (PB-1, PB-5).
  await prisma.prompt.deleteMany({});
  const enP = await importPromptsFromFile(resolve(dir, "prompts.en.json"), "en");
  const arP = await importPromptsFromFile(resolve(dir, "prompts.ar.json"), "ar");
  console.log(`Seeded ${enP} English + ${arP} Arabic prompts.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
