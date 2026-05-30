"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useGameStore } from "@/lib/game-store";
import { bindSocket } from "@/lib/socket";
import { loadPlayerSession } from "@/lib/session-storage";
import { PlayerLobby } from "./player-lobby";
import { PlayerQuestion } from "./player-question";
import { PlayerReveal } from "./player-reveal";
import { PlayerLeaderboard } from "./player-leaderboard";
import { PlayerFinal } from "./player-final";
import { PausedScreen } from "./paused-screen";

export function PlayerScreen({ code }: { code: string }) {
  const room = useGameStore((s) => s.room);
  const selfId = useGameStore((s) => s.selfPlayerId);
  const kicked = useGameStore((s) => s.kicked);
  const t = useTranslations("play");

  useEffect(() => {
    const s = bindSocket();
    const rejoin = () => {
      const session = loadPlayerSession(code);
      if (session) s.emit("player:rejoin", { code, sessionId: session.sessionId });
    };
    s.on("connect", rejoin);
    if (s.connected) rejoin();
    return () => {
      s.off("connect", rejoin);
    };
  }, [code]);

  if (kicked) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center">
        <p className="text-lg font-medium text-muted-foreground">{t("removed")}</p>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <p className="text-muted-foreground">{t("connecting")}</p>
      </main>
    );
  }

  const self = room.players.find((p) => p.id === selfId) ?? null;

  switch (room.phase) {
    case "question":
      return <PlayerQuestion key={room.question?.id ?? "q"} room={room} self={self} />;
    case "reveal":
      return <PlayerReveal room={room} self={self} />;
    case "leaderboard":
      return <PlayerLeaderboard room={room} self={self} />;
    case "final":
      return <PlayerFinal room={room} self={self} />;
    case "paused":
      return <PausedScreen />;
    default:
      return <PlayerLobby room={room} self={self} />;
  }
}
