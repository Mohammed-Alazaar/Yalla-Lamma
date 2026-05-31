// @yalla/db — Prisma 7 client (+ pg adapter) and question-bank access.
export { getPrisma, hasDatabase } from "./client";
export type { PrismaClient } from "./client";
export { loadQuestionPool } from "./questions";
export { loadPromptPool, selectPrompts } from "./prompts";
export { loadFactPool, selectFacts } from "./facts";
export { recordCompletedGame, type CompletedGameInput } from "./games";
export { importFromFile, importPromptsFromFile, importFactsFromFile } from "./import";
