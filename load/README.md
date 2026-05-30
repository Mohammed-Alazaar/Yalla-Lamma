# Load test (PRD NFR-1 / NFR-2)

A Socket.IO driver that spins up many concurrent rooms — each a host plus N
players driving a full game — and reports the answer→broadcast round-trip
latency.

## Run

> **Run the realtime server against a LOCAL or PAID Redis, not Upstash free.**
> The Socket.IO Redis adapter publishes every broadcast, so a 50-room run would
> blow through Upstash's free 500K-commands/month cap (see `docs/adr/0001`).

```bash
# 1. Start Redis locally, then the realtime server pointed at it:
REDIS_URL=redis://localhost:6379 pnpm --filter @yalla/realtime start

# 2. In another shell, drive the load (defaults: 50 rooms × 6 players × 10 Qs):
pnpm load
#   or tune it:
TARGET=ws://localhost:8080 ROOMS=50 PLAYERS=6 QUESTIONS=10 pnpm load
```

## Knobs (env vars)

| Var | Default | Meaning |
|---|---|---|
| `TARGET` | `ws://localhost:8080` | realtime server URL |
| `ROOMS` | `50` | concurrent rooms |
| `PLAYERS` | `6` | players per room |
| `QUESTIONS` | `10` | questions per game |
| `TIME_LIMIT` | `30` | per-question seconds |
| `RAMP_MS` | `100` | delay between room starts |
| `P95_BUDGET_MS` | `400` | NFR-1 pass threshold |

The run exits non-zero (FAIL) if any room errors, a game doesn't complete, or
P95 round-trip exceeds the budget — so it doubles as a CI gate.
