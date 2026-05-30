# End-to-end tests (Playwright)

A headed/headless run of the full game: host creates a room → two players join →
VIP starts a 5-question game → both answer every question → host reaches the
winner screen (PRD §13 Phase 7).

## Run

From the repo root:

```bash
pnpm install
pnpm --filter @yalla/e2e install:browsers   # one-time: downloads Chromium
pnpm test:e2e
```

Playwright's `webServer` config boots both apps automatically:

- realtime server on `:8080` (`pnpm --filter @yalla/realtime start`)
- web dev server on `:3000`, pointed at the local realtime server

so you don't need to start anything by hand. Use `pnpm --filter @yalla/e2e
test:e2e:ui` for the interactive runner.

## Notes

- The game auto-advances through reveal (4s) and the leaderboard (5s) per
  question, so the test takes ~50–60s — the timeouts in `playwright.config.ts`
  account for this.
- In CI, install browsers with `npx playwright install --with-deps chromium`.
