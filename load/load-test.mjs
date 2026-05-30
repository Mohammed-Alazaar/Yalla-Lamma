// Socket.IO load driver (PRD NFR-1/NFR-2): spins up many concurrent rooms, each
// with a host + N players, drives full games, and measures the answer→broadcast
// round-trip. Run the realtime server against a LOCAL or PAID Redis — never
// Upstash free (the Redis adapter publishes every broadcast; see ADR 0001).
//
//   TARGET=ws://localhost:8080 ROOMS=50 PLAYERS=6 QUESTIONS=10 \
//     node load/load-test.mjs
//
import { io } from "socket.io-client";

const TARGET = process.env.TARGET ?? "ws://localhost:8080";
const ROOMS = Number(process.env.ROOMS ?? 50);
const PLAYERS = Number(process.env.PLAYERS ?? 6);
// Must be one of the server's allowed options, else vip:configure is rejected
// and the room keeps its 10-question default.
const VALID_QUESTION_COUNTS = [5, 10, 15, 20];
let QUESTIONS = Number(process.env.QUESTIONS ?? 10);
if (!VALID_QUESTION_COUNTS.includes(QUESTIONS)) {
  console.warn(`QUESTIONS=${QUESTIONS} is not one of ${VALID_QUESTION_COUNTS.join("/")}; using 10.`);
  QUESTIONS = 10;
}
const TIME_LIMIT = Number(process.env.TIME_LIMIT ?? 30);
const RAMP_MS = Number(process.env.RAMP_MS ?? 100); // stagger room starts
const P95_BUDGET_MS = Number(process.env.P95_BUDGET_MS ?? 400);

const latencies = [];
let errors = 0;
let gamesCompleted = 0;

const connect = () =>
  io(TARGET, { transports: ["websocket"], forceNew: true, reconnection: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function once(socket, event, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/**
 * Persistent `state` tracker: records the latest state and lets callers await a
 * predicate, checking the already-received state first. Avoids the race where a
 * fast transition (e.g. all-answered → reveal) fires before a one-shot listener
 * subscribes.
 */
function tracker(socket) {
  let latest = null;
  const waiters = [];
  socket.on("state", (s) => {
    latest = s;
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].pred(s)) {
        waiters[i].resolve(s);
        waiters.splice(i, 1);
      }
    }
  });
  return {
    get latest() {
      return latest;
    },
    waitFor(pred, timeoutMs = 15_000) {
      if (latest && pred(latest)) return Promise.resolve(latest);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout waiting for state")), timeoutMs);
        waiters.push({
          pred,
          resolve: (s) => {
            clearTimeout(timer);
            resolve(s);
          },
        });
      });
    },
  };
}

async function runRoom(index) {
  const host = connect();
  const players = [];
  const ids = [];
  let hostTracker = null;
  try {
    const tokenP = once(host, "host:token");
    host.emit("host:create", { locale: "en" });
    const { roomCode } = await tokenP;

    for (let i = 0; i < PLAYERS; i++) {
      const player = connect();
      players.push(player);
      const join = once(player, "player:session");
      player.emit("player:join", { code: roomCode, name: `P${index}_${i}` });
      ids[i] = (await join).playerId;
    }

    hostTracker = tracker(host);
    const vip = players[0];
    vip.emit("vip:configure", { category: "General", numQuestions: QUESTIONS, timeLimitSec: TIME_LIMIT });
    vip.emit("vip:start");
    let current = await hostTracker.waitFor((s) => s.phase === "question");

    // Count-agnostic: drive by the question's own `isFinal` flag so the loop
    // tracks the server's actual question count.
    while (true) {
      const questionId = current.question.id;
      const isFinal = current.question.isFinal;

      // Every player answers; time each player's own state echo.
      await Promise.all(
        players.map((player, pi) => {
          const t0 = Date.now();
          return new Promise((resolve) => {
            const onState = (s) => {
              if (s.phase === "question" && s.answeredPlayerIds.includes(ids[pi])) {
                player.off("state", onState);
                latencies.push(Date.now() - t0);
                resolve();
              }
            };
            player.on("state", onState);
            // Safety net so a dropped echo can't hang the run.
            setTimeout(() => {
              player.off("state", onState);
              resolve();
            }, 5_000);
            player.emit("player:answer", { questionId, choice: pi % 4 });
          });
        }),
      );

      // Drive past reveal/leaderboard with vip:next to keep traffic dense.
      await hostTracker.waitFor((s) => s.phase === "reveal");
      vip.emit("vip:next");
      await hostTracker.waitFor((s) => s.phase === "leaderboard");
      vip.emit("vip:next");
      if (isFinal) {
        await hostTracker.waitFor((s) => s.phase === "final");
        break;
      }
      current = await hostTracker.waitFor(
        (s) => s.phase === "question" && s.question.id !== questionId,
      );
    }
    gamesCompleted++;
  } catch (err) {
    errors++;
    if (process.env.VERBOSE) console.error(`room ${index}: ${err.message} (stuck at phase=${hostTracker?.latest?.phase})`);
  } finally {
    host.close();
    for (const p of players) p.close();
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function main() {
  console.log(`Load test → ${TARGET} | ${ROOMS} rooms × ${PLAYERS} players × ${QUESTIONS} questions`);
  const start = Date.now();
  const running = [];
  for (let i = 0; i < ROOMS; i++) {
    running.push(runRoom(i));
    await sleep(RAMP_MS); // ramp up
  }
  await Promise.all(running);

  const sorted = latencies.slice().sort((a, b) => a - b);
  const avg = sorted.length ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : 0;
  const p95 = percentile(sorted, 95);

  console.log("\n──────── results ────────");
  console.log(`games completed : ${gamesCompleted}/${ROOMS}`);
  console.log(`errors          : ${errors}`);
  console.log(`answers measured: ${sorted.length}`);
  console.log(`round-trip avg  : ${avg}ms`);
  console.log(`round-trip p50  : ${percentile(sorted, 50)}ms`);
  console.log(`round-trip p95  : ${p95}ms  (budget ${P95_BUDGET_MS}ms)`);
  console.log(`round-trip p99  : ${percentile(sorted, 99)}ms`);
  console.log(`wall clock      : ${((Date.now() - start) / 1000).toFixed(1)}s`);

  const pass = errors === 0 && gamesCompleted === ROOMS && p95 <= P95_BUDGET_MS;
  console.log(`\n${pass ? "PASS" : "FAIL"} (NFR-1 P95 ≤ ${P95_BUDGET_MS}ms, NFR-2 no errors)`);
  process.exit(pass ? 0 : 1);
}

main();
