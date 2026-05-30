import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer auto-loads .env — load the shared root .env (and any local
// override) ourselves before reading DATABASE_URL.
loadEnv({ path: resolve(process.cwd(), "../../.env"), quiet: true });
loadEnv({ quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  // url is required for migrate/introspect; undefined is fine for `generate`/`validate`.
  datasource: { url: process.env.DATABASE_URL },
  migrations: {
    seed: "tsx src/seed.ts",
  },
});
