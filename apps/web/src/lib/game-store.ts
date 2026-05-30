"use client";

import { create } from "zustand";
import type { PublicRoomState, SocketError } from "@yalla/shared";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected";

interface GameState {
  status: ConnectionStatus;
  room: PublicRoomState | null;
  selfPlayerId: string | null; // set for player clients
  lastError: SocketError | null;
  kicked: boolean; // this player was removed by the host (PRD ROOM-7)
  setStatus: (status: ConnectionStatus) => void;
  setRoom: (room: PublicRoomState) => void;
  setSelfPlayerId: (id: string | null) => void;
  setError: (error: SocketError | null) => void;
  setKicked: (kicked: boolean) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  status: "idle",
  room: null,
  selfPlayerId: null,
  lastError: null,
  kicked: false,
  setStatus: (status) => set({ status }),
  setRoom: (room) => set({ room }),
  setSelfPlayerId: (selfPlayerId) => set({ selfPlayerId }),
  setError: (lastError) => set({ lastError }),
  setKicked: (kicked) => set({ kicked }),
  reset: () => set({ room: null, selfPlayerId: null, lastError: null, kicked: false }),
}));
