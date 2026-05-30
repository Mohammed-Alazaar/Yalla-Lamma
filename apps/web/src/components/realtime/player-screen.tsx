"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useGameStore } from "@/lib/game-store";
import { bindSocket } from "@/lib/socket";
import { loadPlayerSession } from "@/lib/session-storage";

export function PlayerScreen({ code }: { code: string }) {
  const room = useGameStore((s) => s.room);
  const selfId = useGameStore((s) => s.selfPlayerId);
  const status = useGameStore((s) => s.status);
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

  const me =
    room?.players.find((p) => p.id === selfId) ??
    (selfId ? null : (room?.players ?? [])[0] ?? null);
  const others = (room?.players ?? []).filter((p) => p.id !== me?.id);

  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10"
      style={me ? { backgroundColor: `${me.color}1a` } : undefined}
    >
      {me ? (
        <div className="flex flex-col items-center gap-3">
          <span
            className="flex size-20 items-center justify-center rounded-full text-3xl font-bold text-white"
            style={{ backgroundColor: me.color }}
          >
            {me.name.charAt(0).toUpperCase()}
          </span>
          <p className="text-2xl font-bold">{me.name}</p>
          {me.isVip && (
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {t("vip")}
            </span>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground">{t(`status.${status}`)}</p>
      )}

      <p className="text-center text-lg text-muted-foreground">{t("waiting")}</p>

      {others.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("othersHere", { count: others.length })}
        </p>
      )}
    </main>
  );
}
