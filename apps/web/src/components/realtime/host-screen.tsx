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
import { ErrorToaster } from "./error-toaster";

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

  let view: React.ReactNode;
  switch (room?.phase) {
    case "question":
      view = <HostQuestion room={room} />;
      break;
    case "reveal":
      view = <HostReveal room={room} />;
      break;
    case "leaderboard":
      view = <HostLeaderboard room={room} />;
      break;
    case "final":
      view = <HostFinal room={room} />;
      break;
    case "paused":
      view = <PausedScreen />;
      break;
    default:
      // lobby / not-yet-connected
      view = <HostLobby room={room ?? null} code={code} origin={origin} />;
  }

  return (
    <>
      {view}
      <ErrorToaster />
    </>
  );
}
