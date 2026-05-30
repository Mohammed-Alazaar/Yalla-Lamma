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

async function joinRoom(
  code: string,
  name: string,
): Promise<{ player: Socket; sessionId: string; playerId: string }> {
  const player = connect();
  const session = await new Promise<{ sessionId: string; playerId: string }>(
    (resolve) => {
      player.on("player:session", resolve);
      player.emit("player:join", { code, name });
    },
  );
  return { player, ...session };
}

test("VIP can configure settings; broadcast reflects them", async () => {
  const { host, code } = await createRoom();
  const states: PublicRoomState[] = [];
  host.on("state", (s) => states.push(s));

  const { player } = await joinRoom(code, "Alice");
  player.emit("vip:configure", {
    category: "Science",
    numQuestions: 15,
    timeLimitSec: 30,
  });
  await wait(150);

  const last = states.at(-1)!;
  expect(last.settings.category).toBe("Science");
  expect(last.settings.numQuestions).toBe(15);
  expect(last.settings.timeLimitSec).toBe(30);

  host.disconnect();
  player.disconnect();
});

test("non-VIP cannot configure", async () => {
  const { host, code } = await createRoom();
  await joinRoom(code, "Alice"); // VIP
  const { player: bob } = await joinRoom(code, "Bob");

  const err = await new Promise<{ code: string }>((resolve) => {
    bob.on("error", resolve);
    bob.emit("vip:configure", {
      category: "Sports",
      numQuestions: 5,
      timeLimitSec: 10,
    });
  });
  expect(err.code).toBe("NOT_VIP");
  host.disconnect();
});

test("profane names are rejected", async () => {
  const { code } = await createRoom();
  const p = connect();
  const err = await new Promise<{ code: string }>((resolve) => {
    p.on("error", resolve);
    p.emit("player:join", { code, name: "sh1t" });
  });
  expect(err.code).toBe("NAME_REJECTED");
  p.disconnect();
});

test("player rejoin restores seat and score", async () => {
  const { host, code } = await createRoom();
  const { player, sessionId, playerId } = await joinRoom(code, "Alice");

  player.disconnect();
  await wait(100);

  const rejoiner = connect();
  const states: PublicRoomState[] = [];
  rejoiner.on("state", (s) => states.push(s));
  const restored = await new Promise<{ playerId: string }>((resolve) => {
    rejoiner.on("player:session", resolve);
    rejoiner.emit("player:rejoin", { code, sessionId });
  });
  expect(restored.playerId).toBe(playerId);

  await wait(150);
  const me = states.at(-1)!.players.find((p) => p.id === playerId);
  expect(me?.connected).toBe(true);

  host.disconnect();
  rejoiner.disconnect();
});
