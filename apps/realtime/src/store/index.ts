import { env } from "../env";
import { MemoryStore } from "./memory";
import { RedisStore } from "./redis";
import type { RoomStore } from "./types";

export const store: RoomStore = env.redisUrl
  ? new RedisStore(env.redisUrl)
  : new MemoryStore();

export const usingRedis = store instanceof RedisStore;

export { RedisStore, MemoryStore };
export { withRoomLock } from "./lock";
export type { RoomStore } from "./types";
