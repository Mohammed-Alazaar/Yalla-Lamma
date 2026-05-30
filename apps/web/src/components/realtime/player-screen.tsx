"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useGameStore } from "@/lib/game-store";
import { bindSocket } from "@/lib/socket";
import { loadPlayerSession } from "@/lib/session-storage";
import { PlayerLobby } from "./player-lobby";

export function PlayerScreen({ code }: { code: string }) {
  const room = useGameStore((s) => s.room);
  const selfId = useGameStore((s) => s.selfPlayerId);
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

  const self = room?.players.find((p) => p.id === selfId) ?? null;

  if (!room) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <p className="text-muted-foreground">{t("connecting")}</p>
      </main>
    );
  }

  // Phase 3 implements the lobby; gameplay views land in Phase 5.
  return <PlayerLobby room={room} self={self} />;
}
