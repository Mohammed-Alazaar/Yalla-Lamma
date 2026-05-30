import { createClient, type RedisClientType } from "redis";
import { ROOM_TTL_SECONDS, type RoomState } from "@yalla/shared";
import type { RoomStore } from "./types";

const roomKey = (code: string) => `room:${code}`;

/**
 * Redis-backed room store (production). The `pub` client also serves as the
 * Socket.IO Redis-adapter publisher; `sub` is the dedicated subscriber.
 */
export class RedisStore implements RoomStore {
  readonly pub: RedisClientType;
  readonly sub: RedisClientType;

  constructor(url: string) {
    this.pub = createClient({ url });
    this.sub = this.pub.duplicate();
  }

  async connect(): Promise<void> {
    await Promise.all([this.pub.connect(), this.sub.connect()]);
  }

  async reserve(room: RoomState): Promise<boolean> {
    const res = await this.pub.set(roomKey(room.code), JSON.stringify(room), {
      NX: true,
      EX: ROOM_TTL_SECONDS,
    });
    return res === "OK";
  }

  async get(code: string): Promise<RoomState | null> {
    const raw = await this.pub.get(roomKey(code));
    return raw ? (JSON.parse(raw) as RoomState) : null;
  }

  async save(room: RoomState): Promise<void> {
    await this.pub.set(roomKey(room.code), JSON.stringify(room), {
      EX: ROOM_TTL_SECONDS,
    });
  }

  async delete(code: string): Promise<void> {
    await this.pub.del(roomKey(code));
  }
}
