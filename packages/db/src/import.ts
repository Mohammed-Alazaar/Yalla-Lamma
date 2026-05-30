import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "dotenv";
import { getPrisma } from "./client";

config({ path: resolve(process.cwd(), "../../.env"), quiet: true });
config({ quiet: true });

interface ImportRow {
  text: string;
  choices: string[];
  correctIdx: number;
  category: string;
  difficulty: string;
  locale: string;
}

/** Split a CSV line, honoring double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields.map((f) => f.trim());
}

/**
 * CSV columns: text, choices (pipe-separated), correctIdx, category, difficulty, locale.
 */
function parseCsv(content: string): ImportRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]!);
  const col = (name: string) => header.indexOf(name);
  const [ti, ci, ri, cati, di, li] = [
    col("text"),
    col("choices"),
    col("correctIdx"),
    col("category"),
    col("difficulty"),
    col("locale"),
  ];
  return lines.slice(1).map((line) => {
    const f = splitCsvLine(line);
    return {
      text: f[ti] ?? "",
      choices: (f[ci] ?? "").split("|").map((c) => c.trim()),
      correctIdx: Number(f[ri]),
      category: f[cati] ?? "",
      difficulty: f[di] ?? "",
      locale: f[li] ?? "en",
    };
  });
}

function isValid(r: ImportRow): boolean {
  return (
    typeof r.text === "string" &&
    r.text.length > 0 &&
    Array.isArray(r.choices) &&
    r.choices.length === 4 &&
    r.choices.every((c) => typeof c === "string" && c.length > 0) &&
    Number.isInteger(r.correctIdx) &&
    r.correctIdx >= 0 &&
    r.correctIdx <= 3 &&
    !!r.category &&
    !!r.difficulty &&
    !!r.locale
  );
}

/** Bulk-import questions from a JSON or CSV file (PRD QB-5). Returns inserted count. */
export async function importFromFile(file: string): Promise<number> {
  const raw = readFileSync(file, "utf8");
  const rows: ImportRow[] = file.endsWith(".csv")
    ? parseCsv(raw)
    : (JSON.parse(raw) as ImportRow[]);

  const valid = rows.filter(isValid);
  const skipped = rows.length - valid.length;
  if (skipped > 0) {
    console.warn(`Skipping ${skipped} invalid row(s).`);
  }

  const result = await getPrisma().question.createMany({ data: valid });
  return result.count;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const file =
    process.argv[2] ?? resolve(import.meta.dirname, "../data/questions.en.json");
  importFromFile(file)
    .then((n) => {
      console.log(`Imported ${n} questions from ${file}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Import failed:", err);
      process.exit(1);
    });
}
