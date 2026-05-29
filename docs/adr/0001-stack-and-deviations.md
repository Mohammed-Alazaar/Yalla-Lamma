# ADR 0001 — Stack versions & approved deviations from the PRD

- **Status:** Accepted
- **Date:** 2026-05-30
- **Context:** The PRD (`docs/PRD.md`) names a target stack but explicitly instructs implementers to
  "verify the latest stable versions … do not assume the versions named here are current." A research
  pass (with adversarial verification against official sources) found several assumptions had drifted.

## Decision — pinned stack (mid-2026)

| Layer | PRD said | We use | Reason |
|---|---|---|---|
| Framework | Next.js 15 | **Next.js 16.2.6** | 15.x is now security-only Maintenance LTS. Greenfield → adopt 16 conventions from day one. |
| React | (implied 18/19) | **19.2.x** | Required by Next 16 App Router. |
| Styling | Tailwind 4 | **Tailwind 4.3** | CSS-first config (`@theme`); `@tailwindcss/postcss` plugin; no `tailwind.config.js`. |
| Realtime | Socket.IO 4.x | **socket.io 4.8.3** + `@socket.io/redis-adapter` 8.3.0 | Current 4.x line; adapter API unchanged. |
| Redis client | (implied node-redis 4) | **redis ^6** on **Node 24 LTS** | RESP3 default; Node ≥ 20 required. |
| i18n | next-intl | **next-intl 4.13** | v4 App-Router pattern; built-in `getLocaleDirection`. |
| ORM | Prisma + Postgres | **Prisma 7.8** + `@prisma/adapter-pg` | Major rewrite: mandatory driver adapter, required generator `output`, `prisma.config.ts`. |
| Validation | Zod | **Zod 4.4** | `import { z } from "zod"` = v4; `.issues`, `z.treeifyError()`, `error:` (not `message:`). |
| Client state | Zustand | **Zustand 5** | — |
| Testing | Vitest + Playwright | **Vitest 4.1**, **Playwright 1.60** | Vitest monorepo via `projects` (not `workspace`). |
| UI | shadcn/ui + Radix | **shadcn CLI (`shadcn`)** + unified **`radix-ui` 1.4** | Use `sonner`/`tw-animate-css`, not deprecated `toast`/`tailwindcss-animate`. |

## Decision — deployment targets

- **Web app → Vercel (Hobby).** Non-commercial only; cannot host WebSockets.
- **Realtime server → Render (free web service)**, NOT Railway. Railway dropped its usable free tier
  ($1/mo non-rolling credit). Render free now keeps WebSocket services awake while clients are connected
  (changed 2026-02-24); ~30–60s cold start only after 15 min fully idle.
- **Redis → Upstash (free, 500K commands/month).** **Postgres → Neon (free; scales to zero after 5 min →
  use the pooled/PgBouncer connection string + retry).**

## Decision — approved deviations from the PRD text

1. **Next.js 16** instead of 15 (async `params`/`searchParams`/`cookies()`/`headers()`, Turbopack default,
   opt-in Cache Components, `middleware.ts` → `proxy.ts`).
2. **Render** as the realtime host instead of "Railway or Render."
3. **pnpm workspaces** for the monorepo (PRD said "no workspace tooling required"; pnpm workspaces is
   lightweight, and avoids React 19 peer-dep friction npm hits with shadcn/recharts). Turborepo stays optional.
4. **Client-side countdown** derived from the server's authoritative `currentQuestionStartedAt` +
   `settings.timeLimitSec`, instead of a 250ms `tick` broadcast. The server stays authoritative for scoring
   (validates `submittedAt` server-side). Rationale: the Socket.IO Redis adapter publishes every broadcast to
   Redis; a 250ms tick would dominate the Upstash 500K-commands/month free budget and the 50-room load test
   would exhaust it instantly. No P0 broken (GAME-2 "timer visible on host" satisfied via local rendering).
5. **Prisma 7** conventions instead of classic Rust-engine Prisma.

## Consequences

- Load testing (NFR-2: 50 rooms) must run against a **local or paid Redis**, not Upstash free.
- `prisma generate` must run before any consumer builds (CI step); generated client is git-ignored.
- Sentry + PostHog are deferred to Phase 6 (not on any P0/success criterion; need external accounts/keys).
