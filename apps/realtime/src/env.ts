import { config } from "dotenv";
import { resolve } from "node:path";

// Load the shared root .env (dev) then a local override; missing files are ignored.
// In production (Render) the platform injects env vars and these are no-ops.
config({ path: resolve(process.cwd(), "../../.env"), quiet: true });
config({ quiet: true });

export const env = {
  port: Number(process.env.PORT ?? 8080),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  /** When unset, the server falls back to an in-process store (dev/test only). */
  redisUrl: process.env.REDIS_URL || null,
};
