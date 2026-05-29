# TriviaParty — Build Specification

> A web-only, phones-as-controllers trivia party game. (Project codename: **Yalla-Lamma**.)

| Field | Value |
|---|---|
| **Product** | TriviaParty — a Jackbox-style trivia game playable entirely in the web browser |
| **Target users** | Friends/family in the same room or on a video call (5–20+ per session) |
| **v1 scope** | 1 game (multiple-choice trivia), English UI, fully working end-to-end |
| **v2 scope** | Arabic UI with full RTL support |
| **Hosting target** | Vercel (web) + Render (realtime server) + Upstash Redis + Neon Postgres |
| **Document type** | Implementation spec |
| **Version** | 1.0 |

> This is the canonical product spec. Implementation decisions and version pins that deviate from this
> document are recorded in `docs/adr/0001-stack-and-deviations.md`.

---

## 1. Instructions

- **Server-authoritative game logic.** Clients never compute their own scores or trust each other. All
  scoring, timing, and state transitions happen on the server.
- **i18n from day one.** All user-facing strings go through `next-intl`. No hardcoded English in components.
- **RTL groundwork from day one.** Use logical CSS properties (`margin-inline-start`, `padding-block`, etc.)
  and never hardcode left/right. `dir="rtl"` must work without rewrites.
- **TypeScript everywhere** (strict mode). Shared types between client and server in a `/packages/shared` folder.
- **Commit in small, reviewable steps** following Section 13's implementation order.
- **Write tests for game logic** (scoring, state transitions, room code generation). UI tests optional for v1.

---

## 2. Product Overview

**TriviaParty** is a real-time multiplayer trivia game played entirely in the web browser. One person opens
the game on a shared screen (TV, laptop, or video-call screen-share) and becomes the host. Everyone else
opens a URL on their phone, enters a 4-letter room code, picks a name, and plays from their phone as a
controller. No app install, no account, no native code.

The game is a fast-paced multiple-choice trivia game inspired by Kahoot and Jackbox. The host screen shows
the question and answer choices publicly; each player sees only the answer buttons on their phone; faster
correct answers earn more points; a live leaderboard updates between rounds; a winner is crowned at the end.

### 2.1 Why web-only
- **Zero friction:** nobody installs anything.
- **One codebase:** the same Next.js app serves the host view, the player controller, and the API.
- **Easy to distribute:** a URL works on Twitch, Discord, WhatsApp, anywhere.

---

## 3. Success Criteria for v1

1. Host can open the site, click "Create Room," and see a 4-letter room code within 2 seconds.
2. Players on different devices/networks can join the room by entering the code in any modern mobile browser.
3. Host can configure number of questions (5/10/15/20), category, and question time limit, then start the game.
4. All players receive each question simultaneously; answers are scored with a speed bonus; results show after each question.
5. A leaderboard updates between questions; a winner screen appears at the end with confetti.
6. A player who loses connection can rejoin with the same name and resume their score.
7. The app is fully localized: switching the UI to a second placeholder locale changes every string. (Arabic itself is v2; the plumbing must work in v1.)
8. The app runs successfully on the deploy target with at least 50 concurrent rooms in load testing.
9. All P0 requirements in Section 6 are met.

---

## 4. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript (strict) |
| Realtime transport | Socket.IO 4.x |
| Realtime server | Standalone Node.js process (separate from Next.js) |
| State store | Redis (Upstash) |
| Database | PostgreSQL (Neon) + Prisma |
| Styling | Tailwind CSS 4 |
| UI components | shadcn/ui + Radix primitives |
| i18n | next-intl |
| State (client) | Zustand |
| Validation | Zod |
| Testing | Vitest + Playwright |
| Hosting (web) | Vercel |
| Hosting (realtime) | Render |
| Analytics | PostHog |
| Error tracking | Sentry |

> Exact pinned versions live in `docs/adr/0001-stack-and-deviations.md`.

---

## 5. Architecture

### 5.1 High-level
Three logical clients (host screen, player controller, audience controller) all run in the browser as routes
of the same Next.js app. They connect to a separate Node.js + Socket.IO server that owns all game state.
Redis backs the Socket.IO server for state and horizontal scaling; PostgreSQL holds the question bank and
persistent data.

### 5.2 Why a separate realtime server
Vercel's serverless functions are stateless and short-lived — they cannot hold WebSocket connections. The
realtime server is a long-lived Node.js process deployed separately (Render). The Next.js app and the
realtime server share types via a `/packages/shared` package but deploy independently.

### 5.3 Repo structure
Monorepo (pnpm workspaces).

```
apps/web                # Next.js app (host UI, player UI, landing, API)
apps/realtime           # Node + Socket.IO server
packages/shared         # types and Zod schemas shared by web + realtime
packages/db             # Prisma schema + migrations for question bank
docs                    # this PRD + ADRs
```

### 5.4 Server-authoritative state
The realtime server is the single source of truth for every room. Clients send **intents** ("I submitted
answer B"); the server validates, computes the consequences (score, next state), and broadcasts the resulting
**state** to everyone in the room.

- Submitting an answer twice for the same question is a no-op the second time.
- Submitting an answer after the timer expires is rejected with no score.
- Only the host (or the room's VIP) can advance phases via dedicated events.

---

## 6. Feature Requirements

**Priorities:** **P0** = must ship in v1, **P1** = ship if time, **P2** = v2 or later.

### 6.1 Room creation & joining
| ID | Requirement | Pri |
|---|---|---|
| ROOM-1 | Host creates a room from the landing page with one click; receives a 4-letter uppercase room code (alphabet excludes I, O, 0, 1). | P0 |
| ROOM-2 | Room codes are unique across all active rooms; collision detection on creation. | P0 |
| ROOM-3 | Room codes expire 30 minutes after the last activity in the room. | P0 |
| ROOM-4 | Player joins via `/join` by entering the code and a display name (1–20 chars, profanity-filtered). | P0 |
| ROOM-5 | QR code on the host screen deep-links to `/play/<CODE>`. | P0 |
| ROOM-6 | Host can lock the room to prevent new joins mid-game. | P1 |
| ROOM-7 | Host can kick a player. | P1 |
| ROOM-8 | Player count cap per room: 12 active players in v1. | P0 |

### 6.2 Lobby
| ID | Requirement | Pri |
|---|---|---|
| LOB-1 | Host screen shows joined players in real time as cards with name and color/avatar. | P0 |
| LOB-2 | First joiner is the VIP and can configure settings + start the game (only the VIP's phone exposes start controls). | P0 |
| LOB-3 | VIP chooses: number of questions (5/10/15/20), category (General/Science/History/Pop Culture/Sports), time limit (10s/20s/30s). | P0 |
| LOB-4 | VIP can start a game once at least 2 players have joined. | P0 |
| LOB-5 | Players assigned a random color from a fixed palette on join; never duplicate within a room. | P0 |

### 6.3 Gameplay
| ID | Requirement | Pri |
|---|---|---|
| GAME-1 | Each question shows on the host screen with 4 choices (A/B/C/D); player phones show only 4 colored buttons (no question text). | P0 |
| GAME-2 | Configurable countdown timer per question; visible on host screen. | P0 |
| GAME-3 | Player submits one answer per question; submission locks immediately ("Answer locked"). | P0 |
| GAME-4 | Score: base 500 for correct + speed bonus up to 500 (linear 500→0 over the timer). Wrong = 0. No negatives. | P0 |
| GAME-5 | After each question: reveal correct answer, per-player result on phone, top movers on host screen. | P0 |
| GAME-6 | Mini-leaderboard appears between questions for 5 seconds; advances automatically. | P0 |
| GAME-7 | Final question: 2× points multiplier. | P0 |
| GAME-8 | Winner screen with podium (1st/2nd/3rd) + confetti; full final standings below. | P0 |
| GAME-9 | After winner screen: VIP can "Play again" (same room, new questions) or "End session." | P0 |

### 6.4 Reconnection
| ID | Requirement | Pri |
|---|---|---|
| RECON-1 | Client persists session ID in localStorage on join. | P0 |
| RECON-2 | On reconnect within 60s, server restores player's seat, score, and current question state. | P0 |
| RECON-3 | If a player misses a question entirely due to disconnect, they get 0 (no retroactive scoring). | P0 |
| RECON-4 | Host disconnect: room "paused" for 60s; if host returns, resume; else end gracefully. | P0 |

### 6.5 Question bank
| ID | Requirement | Pri |
|---|---|---|
| QB-1 | Seed database with at least 200 English trivia questions across 5 categories. | P0 |
| QB-2 | Schema: id, text, choices (4), correct_index, category, difficulty, locale. | P0 |
| QB-3 | Each game pulls a random non-repeating set within the chosen category and difficulty. | P0 |
| QB-4 | Same question never appears twice in a single game. | P0 |
| QB-5 | Admin script to bulk-import questions from CSV/JSON. | P0 |
| QB-6 | Questions localized via locale column; for v2 Arabic, add `ar` rows. | P0 |

### 6.6 i18n & RTL
| ID | Requirement | Pri |
|---|---|---|
| I18N-1 | All user-facing strings extracted to `messages/<locale>.json` via next-intl. | P0 |
| I18N-2 | Locale from URL (`/en/...`, `/ar/...`); English default. | P0 |
| I18N-3 | Locale switcher in the footer of every page. | P0 |
| I18N-4 | `<html lang>` and `<html dir>` set per request based on locale. | P0 |
| I18N-5 | All CSS uses logical properties; zero hardcoded left/right. | P0 |
| I18N-6 | Directional icons flip in RTL via CSS `[dir="rtl"]` selector. | P0 |
| I18N-7 | Question bank schema includes a locale column; queries filter by current locale. | P0 |
| I18N-8 | Numbers/dates/timers use `Intl.NumberFormat` / `Intl.DateTimeFormat` with active locale. | P0 |
| I18N-9 | v2: ship Arabic translations + RTL QA pass. | P2 |
| I18N-10 | v2: add Arabic question bank (200+). | P2 |

### 6.7 Non-functional
| ID | Requirement | Pri |
|---|---|---|
| NFR-1 | Player action round-trip P95 ≤ 400ms within the same region. | P0 |
| NFR-2 | Server handles 50 concurrent rooms with 8 players each in load tests. | P0 |
| NFR-3 | Designed to scale horizontally to 500+ concurrent rooms via Socket.IO Redis adapter. | P0 |
| NFR-4 | Player controller works on iOS Safari 15+, Chrome 100+, Samsung Internet. | P0 |
| NFR-5 | Host screen works on desktop Chrome/Edge/Safari and smart-TV browsers. | P1 |
| NFR-6 | Lighthouse ≥ 90 on the landing page. | P1 |
| NFR-7 | All player input validated server-side with Zod; never trust the client. | P0 |
| NFR-8 | Rate limit: max 10 joins per IP per minute; max 1 answer submission per question per player. | P0 |

---

## 7. Data Models

### 7.1 Game state (Redis, per room)
```typescript
type Phase = "lobby" | "question" | "reveal" | "leaderboard" | "final" | "paused";

interface Player {
  id: string;             // server-generated session id
  name: string;
  color: string;          // hex from fixed palette
  score: number;
  connected: boolean;
  joinedAt: number;       // epoch ms
}

interface RoomState {
  code: string;                       // 4-letter
  hostSocketId: string | null;
  vipPlayerId: string | null;
  players: Record<string, Player>;
  phase: Phase;
  settings: {
    locale: "en" | "ar";
    category: string;
    numQuestions: number;
    timeLimitSec: number;
  };
  questions: Question[];              // pre-selected at game start
  currentIndex: number;               // 0-based
  currentQuestionStartedAt: number;   // epoch ms; for server-side timing
  answers: Record<string, Record<string, { choice: number; submittedAt: number }>>;
  createdAt: number;
  lastActivityAt: number;
}
```

### 7.2 Question (PostgreSQL via Prisma)
```prisma
model Question {
  id          String   @id @default(cuid())
  locale      String
  text        String
  choices     String[]            // length 4
  correctIdx  Int                 // 0..3
  category    String
  difficulty  String              // "easy" | "medium" | "hard"
  createdAt   DateTime @default(now())
  @@index([locale, category, difficulty])
}

model CompletedGame {
  id           String   @id @default(cuid())
  roomCode     String
  playerCount  Int
  questionIds  String[]
  winnerName   String
  startedAt    DateTime
  endedAt      DateTime
  locale       String
}
```

---

## 8. Socket.IO Event Contract

Every event payload validated with Zod on receipt. Shared schemas live in `/packages/shared/events`. The full
state object is sent on every state change.

### 8.1 Client → server
| Event | Payload | Sent by |
|---|---|---|
| `host:create` | `{ locale }` | Host browser when opening a new room |
| `host:rejoin` | `{ code, hostToken }` | Host browser after disconnect |
| `player:join` | `{ code, name }` | Player on enter-name screen |
| `player:rejoin` | `{ code, sessionId }` | Player after disconnect |
| `vip:configure` | `{ category, numQuestions, timeLimitSec }` | VIP only, in lobby |
| `vip:start` | `{}` | VIP only, in lobby |
| `vip:next` | `{}` | VIP, between phases |
| `vip:playAgain` | `{}` | VIP on winner screen |
| `player:answer` | `{ questionId, choice }` | Player during question phase |
| `host:kick` | `{ playerId }` | Host only |

### 8.2 Server → client
| Event | Payload | Sent to |
|---|---|---|
| `state` | `RoomState` (full) | Everyone in room on every state change |
| `error` | `{ code, message }` | The offending client only |
| `kicked` | `{}` | The kicked player only |
| `host:token` | `{ hostToken, roomCode }` | Host only, on create |
| `player:session` | `{ sessionId, playerId }` | Player only, on join |

> Note: the PRD's original `tick { msRemaining }` (250ms) event is intentionally not used — the countdown is
> derived client-side from `currentQuestionStartedAt` + `timeLimitSec`. See ADR 0001.

---

## 9. UI / UX Specifications

### 9.1 Routes
| Route | Purpose |
|---|---|
| `/[locale]/` | Landing — hero, "Create Room" and "Join Room" |
| `/[locale]/host/[code]` | Host shared-screen view |
| `/[locale]/play/[code]` | Player controller (mobile-first) |
| `/[locale]/join` | Enter room code + name |
| `/[locale]/about` | About / how to play |

### 9.2 Host screen
- **Lobby:** huge room code, QR code, scrolling list of joined players with colors.
- **Question:** large question text, 4 choices A/B/C/D with distinct colors (red/blue/yellow/green), countdown ring, live answer count.
- **Reveal:** highlight correct choice, dim others, show top 3 fastest correct answers.
- **Leaderboard:** top 5 with score bars, animated rank changes.
- **Winner:** podium for top 3, confetti, full standings below.

### 9.3 Player controller (mobile-first)
- **Lobby:** "Waiting for host to start", your color, your name, list of others.
- **Question:** 4 large color-coded buttons matching host colors, no question text.
- **Locked:** confirmation that answer was received.
- **Reveal:** "Correct! +750" or "Wrong", current rank + score.
- **Winner:** your final rank and score.

### 9.4 Visual design rules
- Fixed answer-color palette consistent across host and player.
- Minimum tap target: 48×48 CSS pixels.
- Body font supports Latin and Arabic glyphs (Inter + IBM Plex Sans Arabic; switch by locale).
- Dark theme by default; high contrast.

---

## 10. i18n & RTL Implementation Notes

### 10.2 CSS logical properties (use these)
| DON'T | DO |
|---|---|
| `margin-left` | `margin-inline-start` |
| `margin-right` | `margin-inline-end` |
| `padding-left` | `padding-inline-start` |
| `text-align: left` | `text-align: start` |
| `left: 10px` | `inset-inline-start: 10px` |
| `border-left` | `border-inline-start` |

Tailwind 4: use `ms-*`, `me-*`, `ps-*`, `pe-*`, `inset-s-*`, `inset-e-*` (not `ml-*`/`mr-*`/`left-*`/`right-*`).

### 10.3 Direction-flipping icons
```css
[dir="rtl"] .flip-rtl { transform: scaleX(-1); }
```

### 10.5 What MUST work in v1 (even without Arabic translations)
- Visiting `/ar` renders the entire UI mirrored (RTL) using empty Arabic strings, with no layout breakage.
- Every page passes a manual `dir=rtl` test.
- Locale switcher in the footer flips the entire site instantly.

---

## 11. Scalability Plan
- Socket.IO Redis adapter enabled from the first commit (config change to scale out, not a refactor).
- No in-memory game state on the Node process — all reads/writes through the Redis store layer.
- Stateless HTTP for everything except the WebSocket connection.
- v1: single Render node handles ~500 concurrent connections (~60 rooms at 8 players).
- v2+: sticky sessions at the LB (or WebSocket-only transport); any node can serve any room via Redis.

---

## 12. Deployment & Operations

| Service | Provider | Notes |
|---|---|---|
| Next.js web app | Vercel | Auto-deploy from main. |
| Realtime server | Render | Long-lived Node process; `wss://realtime.<domain>`. |
| Redis | Upstash | Serverless Redis; free tier sufficient for v1 (mind the 500K commands/mo cap). |
| PostgreSQL | Neon | Free tier; pooled connection string. |
| Error tracking | Sentry | Web app + realtime server. |
| Analytics | PostHog | Funnel + retention without PII. |

### 12.1 Environment variables
See `.env.example` at the repo root.

---

## 13. Implementation Order

Each phase must work end-to-end and be committed before the next. See the active build plan for the refined,
versioned breakdown.

1. **Foundation** — monorepo, Next.js + Tailwind + next-intl with en+ar routing + RTL switching; empty landing.
2. **Realtime skeleton** — Socket.IO + Redis adapter + Zod handlers; `host:create`/`player:join`/`state`.
3. **Lobby UI** — host + player lobby, VIP designation + settings, reconnection.
4. **Question bank** — Prisma schema, migrate, CSV import, seed 200+ EN questions.
5. **Core gameplay** — game engine (unit-tested), question/reveal/leaderboard/final phases, host + player views.
6. **Polish** — confetti, animations, winner podium, edge cases, profanity filter, observability.
7. **Testing & deploy** — Playwright E2E, load test, RTL audit, production deploy, tag `v1.0.0`.

---

## 14. Out of Scope for v1
User accounts/login; custom player questions; multiple games / game-picker; Twitch/audience mode; native apps;
payments; voice/video chat; Arabic translations (plumbing only); admin dashboard.

---

## 16. Appendix: Key Reference Snippets

### 16.1 Room code generator
```typescript
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O/0/1
export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return code;
}
// Caller retries on collision against Redis.
```

### 16.2 Score formula
```typescript
export function scoreAnswer(opts: {
  isCorrect: boolean;
  msSinceQuestionStart: number;
  timeLimitSec: number;
  isFinalQuestion: boolean;
}): number {
  if (!opts.isCorrect) return 0;
  const timeLimitMs = opts.timeLimitSec * 1000;
  const fraction = Math.max(0, 1 - opts.msSinceQuestionStart / timeLimitMs);
  const base = 500;
  const speedBonus = Math.round(500 * fraction);
  const total = base + speedBonus;
  return opts.isFinalQuestion ? total * 2 : total;
}
```

### 16.4 Definition of Done
- [ ] All P0 requirements met.
- [ ] Two players on different networks can play a full game without errors.
- [ ] Lighthouse ≥ 90 on landing.
- [ ] Load test: 50 concurrent rooms passes.
- [ ] RTL audit: every page renders correctly with `dir="rtl"`.
- [ ] README explains how to run locally and how to deploy.
- [ ] Tagged `v1.0.0`, deployed to production.
