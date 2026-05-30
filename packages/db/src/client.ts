import type { PrismaClient } from "../prisma/generated/client";

let client: PrismaClient | null = null;

/** Whether a database connection is configured. */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Lazily create the singleton Prisma client backed by the pg driver adapter
 * (Prisma 7). The generated client and adapter are imported dynamically so
 * consumers that never touch the database (local dev / tests using the bundled
 * question JSON) don't pull the heavy generated client into their module graph.
 * Use the Neon POOLED connection string in production.
 */
export async function getPrisma(
  connectionString = process.env.DATABASE_URL,
): Promise<PrismaClient> {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to use the database");
  }
  if (!client) {
    const [{ PrismaPg }, { PrismaClient }] = await Promise.all([
      import("@prisma/adapter-pg"),
      import("../prisma/generated/client"),
    ]);
    const adapter = new PrismaPg({ connectionString });
    client = new PrismaClient({ adapter });
  }
  return client;
}

export type { PrismaClient };
