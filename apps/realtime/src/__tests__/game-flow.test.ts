import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "socket.io";
import { io as ioc, type Socket } from "socket.io-client";
import { afterAll, beforeAll, expect, test } from "vitest";
import type { PublicRoomState } from "@yalla/shared";
import { registerHandlers } from "../handlers";
import { clearAllRoomTimers } from "../game/flow";
import type { AppServer } from "../lib/types";

let httpServer: HttpServer;
let io: AppServer;
let port: number;

beforeAll(async () => {
  httpServer = createServer();
  io = new Server(httpServer);
  io.on("connection", (socket) => registerHandlers(io, socket));
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as AddressInfo).port;
});

afterAll(async () => {
  clearAllRoomTimers();
  await io.close();
  httpServer.close();
});

const connect = (): Socket =>
  ioc(`http://localhost:${port}`, { transports: ["websocket"], forceNew: true });

/** Tracks the latest `state` broadcast on a socket and lets tests await one. */
function track(socket: Socket) {
  let latest: PublicRoomState | null = null;
  type Waiter = { pred: (s: PublicRoomState) => boolean; resolve: (s: PublicRoomState) => void };
  const waiters: Waiter[] = [];
  socket.on("state", (s: PublicRoomState) => {
    latest = s;
    for (let i = waiters.length - 1; i >= 0; i--) {
      const w = waiters[i]!;
      if (w.pred(s)) {
        w.resolve(s);
        waiters.splice(i, 1);
      }
    }
  });
  return {
    get latest() {
      return latest;
    },
    waitFor(pred: (s: PublicRoomState) => boolean, ms = 2000): Promise<PublicRoomState> {
      if (latest && pred(latest)) return Promise.resolve(latest);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("waitFor timed out")), ms);
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

async function createRoom(): Promise<{ host: Socket; code: string }> {
  const host = connect();
  const code = await new Promise<string>((resolve) => {
    host.on("host:token", (p) => resolve(p.roomCode));
    host.emit("host:create", { locale: "en" });
  });
  return { host, code };
}

async function join(code: string, name: string): Promise<{ socket: Socket; playerId: string }> {
  const socket = connect();
  const { playerId } = await new Promise<{ playerId: string }>((resolve) => {
    socket.on("player:session", resolve);
    socket.emit("player:join", { code, name });
  });
  return { socket, playerId };
}

test("full game: start → answer → reveal → leaderboard → final → play again", async () => {
  const { host, code } = await createRoom();
  const hostState = track(host);

  const { socket: alice } = await join(code, "Alice"); // VIP (first joiner)
  const { socket: bob } = await join(code, "Bob");

  // Shortest valid game (numQuestions ∈ {5,10,15,20}); driven by vip:next so we
  // never wait on the real auto-advance timers.
  const TOTAL = 5;
  alice.emit("vip:configure", { category: "General", numQuestions: TOTAL, timeLimitSec: 10 });
  await hostState.waitFor((s) => s.settings.numQuestions === TOTAL);

  alice.emit("vip:start");
  const q = await hostState.waitFor((s) => s.phase === "question");
  expect(q.question).not.toBeNull();
  expect(q.question?.index).toBe(0);
  expect(q.question?.total).toBe(TOTAL);
  expect(q.question?.correctIdx).toBeNull(); // redacted before reveal
  expect(q.questionStartedAt).toBeGreaterThan(0);

  for (let i = 0; i < TOTAL; i++) {
    const questionId = hostState.latest!.question!.id;

    // One player answers — still in question phase, count reflects it.
    alice.emit("player:answer", { questionId, choice: 0 });
    await hostState.waitFor(
      (s) => s.phase === "question" && s.answeredPlayerIds.length === 1,
    );

    // Duplicate submission is a silent no-op (count stays at 1).
    alice.emit("player:answer", { questionId, choice: 2 });

    // Second player answers → all connected answered → auto-advance to reveal.
    bob.emit("player:answer", { questionId, choice: 1 });
    const reveal = await hostState.waitFor((s) => s.phase === "reveal");
    expect(reveal.answeredPlayerIds.length).toBe(2); // exactly two distinct answers
    expect(reveal.question?.correctIdx).not.toBeNull(); // now exposed
    expect(reveal.results).not.toBeNull();
    expect(reveal.results?.length).toBe(2);

    alice.emit("vip:next"); // reveal → leaderboard
    await hostState.waitFor((s) => s.phase === "leaderboard");

    alice.emit("vip:next"); // leaderboard → next question | final
    const isLast = i === TOTAL - 1;
    await hostState.waitFor((s) => s.phase === (isLast ? "final" : "question"));
  }

  const final = hostState.latest!;
  expect(final.phase).toBe("final");
  // Exactly one winner determinable from scores.
  const top = [...final.players].sort((a, b) => b.score - a.score)[0];
  expect(top).toBeDefined();

  alice.emit("vip:playAgain");
  const lobby = await hostState.waitFor((s) => s.phase === "lobby");
  expect(lobby.players.every((p) => p.score === 0)).toBe(true);

  host.disconnect();
  alice.disconnect();
  bob.disconnect();
});

test("cannot start with fewer than two players", async () => {
  const { host, code } = await createRoom();
  const { socket: alice } = await join(code, "Alice");
  const err = await new Promise<{ code: string }>((resolve) => {
    alice.on("error", resolve);
    alice.emit("vip:start");
  });
  expect(err.code).toBe("NOT_ENOUGH_PLAYERS");
  host.disconnect();
  alice.disconnect();
});

test("a non-VIP player cannot start the game", async () => {
  const { host, code } = await createRoom();
  await join(code, "Alice"); // VIP
  const { socket: bob } = await join(code, "Bob");
  const err = await new Promise<{ code: string }>((resolve) => {
    bob.on("error", resolve);
    bob.emit("vip:start");
  });
  expect(err.code).toBe("NOT_VIP");
  host.disconnect();
  bob.disconnect();
});
