"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import type { SocketError } from "@yalla/shared";
import { useGameStore } from "@/lib/game-store";
import { bindSocket } from "@/lib/socket";
import { loadPlayerSession } from "@/lib/session-storage";
import { PlayerLobby } from "./player-lobby";
import { PlayerJoin } from "./player-join";
import { PlayerQuestion } from "./player-question";
import { PlayerReveal } from "./player-reveal";
import { PlayerLeaderboard } from "./player-leaderboard";
import { PlayerFinal } from "./player-final";
import { PausedScreen } from "./paused-screen";
import { ErrorToaster } from "./error-toaster";
import { PlayerQuip } from "./quip/player-quip";

const noopSubscribe = () => () => {};

export function PlayerScreen({ code }: { code: string }) {
  const room = useGameStore((s) => s.room);
  const selfId = useGameStore((s) => s.selfPlayerId);
  const kicked = useGameStore((s) => s.kicked);
  const t = useTranslations("play");

  // SSR-safe check for a saved session (returning player vs. fresh QR scan).
  const hasSession = useSyncExternalStore(
    noopSubscribe,
    () => loadPlayerSession(code) !== null,
    () => false,
  );
  const [rejoinFailed, setRejoinFailed] = useState(false);

  useEffect(() => {
    const s = bindSocket();
    if (!hasSession) return; // fresh player — they'll join by name below
    const rejoin = () => {
      const session = loadPlayerSession(code);
      if (session) s.emit("player:rejoin", { code, sessionId: session.sessionId });
    };
    const onError = (e: SocketError) => {
      if (e.code === "SESSION_INVALID") setRejoinFailed(true); // stale session → show name form
    };
    s.on("connect", rejoin);
    s.on("error", onError);
    if (s.connected) rejoin();
    return () => {
      s.off("connect", rejoin);
      s.off("error", onError);
    };
  }, [code, hasSession]);

  if (kicked) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center">
        <p className="text-lg font-medium text-muted-foreground">{t("removed")}</p>
      </main>
    );
  }

  // Not in a room yet: prompt a fresh/expired player for a name, else connecting.
  if (!room) {
    if (!hasSession || rejoinFailed) return <PlayerJoin code={code} />;
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <p className="text-muted-foreground">{t("connecting")}</p>
      </main>
    );
  }

  const self = room.players.find((p) => p.id === selfId) ?? null;

  let view: React.ReactNode;
  switch (room.phase) {
    case "question":
      view = <PlayerQuestion key={room.question?.id ?? "q"} room={room} self={self} />;
      break;
    case "reveal":
      view = <PlayerReveal room={room} self={self} />;
      break;
    case "leaderboard":
      view = <PlayerLeaderboard room={room} self={self} />;
      break;
    case "playing":
      view = <PlayerQuip room={room} self={self} />;
      break;
    case "final":
      view = <PlayerFinal room={room} self={self} />;
      break;
    case "paused":
      view = <PausedScreen />;
      break;
    default:
      view = <PlayerLobby room={room} self={self} />;
  }

  return (
    <>
      {view}
      <ErrorToaster />
    </>
  );
}
