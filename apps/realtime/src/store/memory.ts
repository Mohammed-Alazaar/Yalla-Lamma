import { ROOM_TTL_SECONDS, type RoomState } from "@yalla/shared";
import type { RoomStore } from "./types";

/**
 * In-process room store for local dev / tests (no Redis required). Clones on
 * read/write to mimic Redis serialization semantics and avoid shared-reference
 * mutation bugs. NOT used in production (single-process only).
 */
export class MemoryStore implements RoomStore {
  private readonly map = new Map<string, { room: RoomState; expiresAt: number }>();

  async connect(): Promise<void> {}

  private alive(code: string): RoomState | null {
    const entry = this.map.get(code);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(code);
      return null;
    }
    return entry.room;
  }

  async reserve(room: RoomState): Promise<boolean> {
    if (this.alive(room.code)) return false;
    this.map.set(room.code, {
      room: structuredClone(room),
      expiresAt: Date.now() + ROOM_TTL_SECONDS * 1000,
    });
    return true;
  }

  async get(code: string): Promise<RoomState | null> {
    const room = this.alive(code);
    return room ? structuredClone(room) : null;
  }

  async save(room: RoomState): Promise<void> {
    this.map.set(room.code, {
      room: structuredClone(room),
      expiresAt: Date.now() + ROOM_TTL_SECONDS * 1000,
    });
  }

  async delete(code: string): Promise<void> {
    this.map.delete(code);
  }
}
