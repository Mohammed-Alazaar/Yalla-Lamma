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

function track(socket: Socket) {
  let latest: PublicRoomState | null = null;
  type Waiter = { pred: (s: PublicRoomState) => boolean; resolve: (s: PublicRoomState) => void };
  const waiters: Waiter[] = [];
  socket.on("state", (s: PublicRoomState) => {
    latest = s;
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i]!.pred(s)) {
        waiters[i]!.resolve(s);
        waiters.splice(i, 1);
      }
    }
  });
  return {
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

async function join(code: string, name: string): Promise<Socket> {
  const socket = connect();
  await new Promise((resolve) => {
    socket.on("player:session", resolve);
    socket.emit("player:join", { code, name });
  });
  return socket;
}

test("host disconnect pauses the game; rejoin resumes it (RECON-4)", async () => {
  const host = connect();
  const { code, hostToken } = await new Promise<{ code: string; hostToken: string }>((res) => {
    host.on("host:token", (p) => res({ code: p.roomCode, hostToken: p.hostToken }));
    host.emit("host:create", { locale: "en" });
  });

  const alice = await join(code, "Alice"); // VIP
  const aliceState = track(alice);
  await join(code, "Bob");

  alice.emit("vip:start");
  await aliceState.waitFor((s) => s.phase === "question");

  // Host drops — game pauses.
  host.disconnect();
  const paused = await aliceState.waitFor((s) => s.phase === "paused");
  expect(paused.phase).toBe("paused");
  expect(paused.hostConnected).toBe(false);

  // Host comes back with its token — game resumes mid-question.
  const host2 = connect();
  host2.emit("host:rejoin", { code, hostToken });
  const resumed = await aliceState.waitFor((s) => s.phase === "question" && s.hostConnected);
  expect(resumed.phase).toBe("question");
  expect(resumed.question).not.toBeNull();

  host2.disconnect();
  alice.disconnect();
});
