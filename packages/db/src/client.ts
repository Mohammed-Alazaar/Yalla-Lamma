import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/client";

let client: PrismaClient | null = null;

/** Whether a database connection is configured. */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Lazily create the singleton Prisma client backed by the pg driver adapter
 * (Prisma 7). Use the Neon POOLED connection string in production.
 */
export function getPrisma(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to use the database");
  }
  if (!client) {
    const adapter = new PrismaPg({ connectionString });
    client = new PrismaClient({ adapter });
  }
  return client;
}

export { PrismaClient };
