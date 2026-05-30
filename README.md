# TriviaParty — Yalla-Lamma

A web-only, phones-as-controllers trivia party game (Jackbox/Kahoot style).
One shared **host screen** (TV/laptop) plus **player phones** as controllers —
no installs, no accounts, just a 4-letter room code. English UI today, with
Arabic/RTL groundwork in place (يلا لمّة — "let's gather").

- **Server-authoritative**: phones send intents; the realtime server validates
  every payload with Zod, scores answers, and broadcasts a redacted room state.
- **i18n + RTL** from day one via next-intl (`/en`, `/ar`), logical CSS only.
- **Runs locally with zero infrastructure** — falls back to an in-memory room
  store and a bundled question bank when Redis/Postgres aren't configured.

## Architecture

```
apps/web        Next.js 16 (App Router) — host UI, player UI, landing      → Vercel
apps/realtime   Node 22 + Socket.IO — owns ALL game state                  → Render (free web service)
packages/shared TS types + Zod schemas for every event + pure game scoring → consumed by both apps
packages/db     Prisma 7 (+ pg adapter) question bank + seed/importer      → Neon Postgres
```

The realtime server is the single source of truth. Clients never compute scores
or advance phases. The countdown is rendered client-side from the server's
`questionStartedAt` + `timeLimitSec` (no per-tick broadcast — see
[`docs/adr/0001-stack-and-deviations.md`](docs/adr/0001-stack-and-deviations.md)).

## Prerequisites

- **Node 22+** and **pnpm 11** (`corepack enable` activates the pinned version).
- Redis and Postgres are **optional** for local development.

## Local development

```bash
pnpm install

# Run web (http://localhost:3000) and realtime (http://localhost:8080) together:
pnpm dev

# …or individually:
pnpm dev:web
pnpm dev:realtime
```

Open `http://localhost:3000`, create a room on one screen, and join from a
phone/another tab via the QR code or the 4-letter code. With no `REDIS_URL` the
server uses an in-memory store; with no `DATABASE_URL` it serves the bundled
238-question English bank.

### Environment

Copy `.env.example` → `.env` (root, for the realtime server + db tooling) and
set `apps/web/.env.local` for the web app. Every variable is documented in
`.env.example`; all of Redis, Postgres, Sentry, and PostHog are optional.

| Variable | App | Purpose |
|---|---|---|
| `NEXT_PUBLIC_REALTIME_URL` | web | Socket.IO server URL (`ws://localhost:8080` locally) |
| `PORT` | realtime | Listen port (Render injects this) |
| `ALLOWED_ORIGINS` | realtime | Comma-separated CORS origins |
| `REDIS_URL` | realtime | Redis/Upstash; omit → in-memory store |
| `DATABASE_URL` | db/realtime | Neon **pooled** string; omit → bundled JSON |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` | web / both servers | Error monitoring (optional) |
| `NEXT_PUBLIC_POSTHOG_KEY` / `POSTHOG_KEY` | web / realtime | Analytics (optional) |

## Scripts

```bash
pnpm dev          # run both apps
pnpm build        # generate Prisma client, then build all packages
pnpm test         # unit + integration tests (Vitest)
pnpm typecheck    # tsc --noEmit across the workspace
pnpm lint         # eslint
pnpm db:generate  # prisma generate
pnpm db:migrate   # prisma migrate dev   (needs DATABASE_URL)
pnpm db:seed      # seed the question bank from data/questions.en.json
pnpm db:import    # bulk-import questions from a JSON/CSV file (QB-5)
```

## Testing

- **Unit** (`packages/shared`, `apps/realtime`): scoring (PRD §16.2), room-code
  generation/validation, phase transitions, no-double-submit, disconnect misses,
  and `toPublicRoomState` redaction (the correct answer/secrets never leak).
- **Integration** (`apps/realtime`): scripted Socket.IO clients drive a full
  game (start → answer → reveal → leaderboard → final → play again), plus
  host-pause/resume (RECON-4) and kick/lock (ROOM-6/7).

```bash
pnpm test
```

End-to-end (Playwright) and load tests live under `e2e/` and `load/` — see
those folders for how to run them.

## Deployment

The two apps deploy independently.

### 1. Data services
- **Neon** (Postgres): create a project, run `pnpm db:migrate` + `pnpm db:seed`
  against it, and use the **pooled** connection string at runtime.
- **Upstash** (Redis): create a database and copy its `rediss://` URL.

### 2. Realtime → Render (free web service)
Use the included [`render.yaml`](render.yaml) Blueprint, then set
`ALLOWED_ORIGINS` (your Vercel URL), `REDIS_URL`, and `DATABASE_URL` in the
dashboard. Render free keeps the WebSocket service awake while clients are
connected; expect a ~30–60s cold start after long idle.

### 3. Web → Vercel
Import the repo, set **Root Directory** to `apps/web` (Vercel auto-detects the
pnpm workspace and Next.js), and set `NEXT_PUBLIC_REALTIME_URL` to your Render
URL (use `wss://`). Deploy.

### 4. Smoke test
Open the Vercel URL on two devices on different networks and play a full game.

## Project layout

```
apps/web/          Next.js app (App Router, next-intl, Tailwind 4, shadcn)
apps/realtime/     Socket.IO server: handlers, pure game engine, room store
packages/shared/   event schemas, game types, scoring, redaction
packages/db/       Prisma schema, client, seed/import, question JSON
docs/              PRD + architecture decision records
```
