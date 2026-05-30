import { getPrisma, hasDatabase } from "./client";

export interface CompletedGameInput {
  roomCode: string;
  playerCount: number;
  questionIds: string[];
  winnerName: string;
  startedAt: Date;
  endedAt: Date;
  locale: string;
}

/**
 * Persist end-of-game stats (PRD §7.2). No-op when no database is configured
 * (local dev / tests) so the game still completes without Postgres.
 */
export async function recordCompletedGame(input: CompletedGameInput): Promise<void> {
  if (!hasDatabase()) return;
  const prisma = await getPrisma();
  await prisma.completedGame.create({ data: input });
}
