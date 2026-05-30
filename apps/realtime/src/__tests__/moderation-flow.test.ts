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
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

test("host can kick a player; the VIP role is reassigned (ROOM-7)", async () => {
  const { host, code } = await createRoom();
  const states: PublicRoomState[] = [];
  host.on("state", (s) => states.push(s));

  const { socket: alice, playerId: aliceId } = await join(code, "Alice"); // VIP
  const { playerId: bobId } = await join(code, "Bob");
  await wait(100);

  const wasKicked = new Promise<boolean>((resolve) => {
    alice.on("kicked", () => resolve(true));
  });

  host.emit("host:kick", { playerId: aliceId });
  expect(await wasKicked).toBe(true);
  await wait(150);

  const last = states.at(-1)!;
  expect(last.players.some((p) => p.id === aliceId)).toBe(false);
  expect(last.players.some((p) => p.id === bobId)).toBe(true);
  expect(last.vipPlayerId).toBe(bobId); // VIP handed off

  host.disconnect();
});

test("host can lock the room; new joins are rejected (ROOM-6)", async () => {
  const { host, code } = await createRoom();
  await join(code, "Alice");
  await wait(50);

  host.emit("host:lock", { locked: true });
  await wait(100);

  const latecomer = connect();
  const err = await new Promise<{ code: string }>((resolve) => {
    latecomer.on("error", resolve);
    latecomer.emit("player:join", { code, name: "Zed" });
  });
  expect(err.code).toBe("ROOM_LOCKED");

  host.disconnect();
  latecomer.disconnect();
});

test("a non-host socket cannot kick or lock", async () => {
  const { host, code } = await createRoom();
  const { socket: alice, playerId } = await join(code, "Alice");

  const err = await new Promise<{ code: string }>((resolve) => {
    alice.on("error", resolve);
    alice.emit("host:lock", { locked: true });
  });
  expect(err.code).toBe("NOT_HOST");

  void playerId;
  host.disconnect();
  alice.disconnect();
});
