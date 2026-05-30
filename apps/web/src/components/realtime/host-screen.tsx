"use client";

import { useEffect } from "react";
import { useGameStore } from "@/lib/game-store";
import { bindSocket } from "@/lib/socket";
import { loadHostToken } from "@/lib/session-storage";
import { HostLobby } from "./host-lobby";

export function HostScreen({
  code,
  origin,
}: {
  code: string;
  origin: string;
}) {
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

  // Phase 3 implements the lobby; question/reveal/leaderboard/final views land in Phase 5.
  return <HostLobby room={room} code={code} origin={origin} />;
}
