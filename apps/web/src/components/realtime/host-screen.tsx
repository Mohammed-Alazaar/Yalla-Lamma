"use client";

import { useEffect } from "react";
import { useGameStore } from "@/lib/game-store";
import { bindSocket } from "@/lib/socket";
import { loadHostToken } from "@/lib/session-storage";
import { HostLobby } from "./host-lobby";
import { HostQuestion } from "./host-question";
import { HostReveal } from "./host-reveal";
import { HostLeaderboard } from "./host-leaderboard";
import { HostFinal } from "./host-final";
import { PausedScreen } from "./paused-screen";

export function HostScreen({ code, origin }: { code: string; origin: string }) {
  const room = useGameStore((s) => s.room);

  useEffect(() => {
    const s = bindSocket();
    const rejoin = () => {
      const hostToken = loadHostToken(code);
      if (hostToken) s.emit("host:rejoin", { code, hostToken });
    };
    s.on("connect", rejoin);
    if (s.connected) rejoin();
    return () => {
      s.off("connect", rejoin);
    };
  }, [code]);

  switch (room?.phase) {
    case "question":
      return <HostQuestion room={room} />;
    case "reveal":
      return <HostReveal room={room} />;
    case "leaderboard":
      return <HostLeaderboard room={room} />;
    case "final":
      return <HostFinal room={room} />;
    case "paused":
      return <PausedScreen />;
    default:
      // lobby / not-yet-connected
      return <HostLobby room={room ?? null} code={code} origin={origin} />;
  }
}
