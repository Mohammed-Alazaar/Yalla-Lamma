import type { RoomState } from "@yalla/shared";

/** Persistence for room state. Implemented by Redis (prod) and memory (dev). */
export interface RoomStore {
  connect(): Promise<void>;
  /** Atomically create the room iff its code is free. Returns false on collision. */
  reserve(room: RoomState): Promise<boolean>;
  get(code: string): Promise<RoomState | null>;
  /** Upsert with a refreshed TTL (PRD ROOM-3: 30 min from last activity). */
  save(room: RoomState): Promise<void>;
  delete(code: string): Promise<void>;
}
