import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "socket.io";
import { io as ioc, type Socket } from "socket.io-client";
import { afterAll, beforeAll, expect, test } from "vitest";
import type { PublicRoomState } from "@yalla/shared";
import { registerHandlers } from "../handlers";
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
  await io.close();
  httpServer.close();
});

function connect(): Socket {
  return ioc(`http://localhost:${port}`, {
    transports: ["websocket"],
    forceNew: true,
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("host:create returns a valid code; player:join appears in broadcast state as VIP", async () => {
  const host = connect();

  const roomCode = await new Promise<string>((resolve) => {
    host.on("host:token", (p) => resolve(p.roomCode));
    host.emit("host:create", { locale: "en" });
  });
  expect(roomCode).toMatch(/^[A-HJ-NP-Z]{4}$/);

  const hostStates: PublicRoomState[] = [];
  host.on("state", (s) => hostStates.push(s));

  const player = connect();
  const session = await new Promise<{ playerId: string; sessionId: string }>(
    (resolve) => {
      player.on("player:session", (p) => resolve(p));
      player.emit("player:join", { code: roomCode, name: "Alice" });
    },
  );
  expect(session.playerId).toBeTruthy();
  expect(session.sessionId).toBeTruthy();

  await wait(150);

  const last = hostStates.at(-1);
  expect(last).toBeDefined();
  expect(last!.phase).toBe("lobby");
  expect(last!.players).toHaveLength(1);
  expect(last!.players[0]!.name).toBe("Alice");
  expect(last!.players[0]!.isVip).toBe(true);
  expect(last!.players[0]!.id).toBe(session.playerId);

  host.disconnect();
  player.disconnect();
});

test("second player gets a distinct color and is not VIP; duplicate name rejected", async () => {
  const host = connect();
  const roomCode = await new Promise<string>((resolve) => {
    host.on("host:token", (p) => resolve(p.roomCode));
    host.emit("host:create", { locale: "en" });
  });

  const states: PublicRoomState[] = [];
  host.on("state", (s) => states.push(s));

  const p1 = connect();
  await new Promise((resolve) => {
    p1.on("player:session", resolve);
    p1.emit("player:join", { code: roomCode, name: "Alice" });
  });

  const p2 = connect();
  await new Promise((resolve) => {
    p2.on("player:session", resolve);
    p2.emit("player:join", { code: roomCode, name: "Bob" });
  });

  await wait(150);
  const last = states.at(-1)!;
  expect(last.players).toHaveLength(2);
  const [a, b] = last.players;
  expect(a!.color).not.toBe(b!.color);
  expect(a!.isVip).toBe(true);
  expect(b!.isVip).toBe(false);

  // Duplicate name is rejected with an error.
  const p3 = connect();
  const err = await new Promise<{ code: string }>((resolve) => {
    p3.on("error", (e) => resolve(e));
    p3.emit("player:join", { code: roomCode, name: "alice" });
  });
  expect(err.code).toBe("NAME_TAKEN");

  host.disconnect();
  p1.disconnect();
  p2.disconnect();
  p3.disconnect();
});
