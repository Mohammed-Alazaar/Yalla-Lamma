// One-off: extract the generated question set from a workflow result file into
// the committed seed data file. Usage: node build-data.mjs <workflow-output.json>
import fs from "node:fs";
import path from "node:path";

const src = process.argv[2];
if (!src) {
  console.error("usage: node build-data.mjs <workflow-output.json>");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(src, "utf8"));
const questions = raw?.result?.questions ?? raw?.questions ?? [];

const seen = new Set();
const out = [];
for (const q of questions) {
  const text = String(q.text ?? "").trim();
  const choices = Array.isArray(q.choices) ? q.choices.map((c) => String(c).trim()) : [];
  const ci = q.correctIdx;
  const ok =
    text.length > 0 &&
    choices.length === 4 &&
    choices.every((c) => c.length > 0) &&
    new Set(choices.map((c) => c.toLowerCase())).size === 4 &&
    Number.isInteger(ci) &&
    ci >= 0 &&
    ci <= 3;
  if (!ok) continue;
  const key = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (seen.has(key)) continue;
  seen.add(key);
  out.push({
    text,
    choices,
    correctIdx: ci,
    category: q.category,
    difficulty: q.difficulty,
    locale: q.locale ?? "en",
  });
}

const dir = path.resolve("packages/db/data");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "questions.en.json"), JSON.stringify(out, null, 2) + "\n");

const by = {};
for (const q of out) by[q.category] = (by[q.category] ?? 0) + 1;
console.log("wrote", out.length, JSON.stringify(by));
