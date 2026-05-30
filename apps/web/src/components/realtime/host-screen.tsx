"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useGameStore } from "@/lib/game-store";
import { bindSocket } from "@/lib/socket";
import { loadHostToken } from "@/lib/session-storage";

export function HostScreen({ code }: { code: string }) {
  const room = useGameStore((s) => s.room);
  const status = useGameStore((s) => s.status);
  const t = useTranslations("host");

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

  const players = room?.players ?? [];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col items-center gap-10 px-6 py-10">
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {t("roomCode")}
        </p>
        <p className="font-mono text-6xl font-extrabold tracking-[0.3em] sm:text-8xl">
          {code}
        </p>
      </div>

      <section className="w-full">
        <h2 className="mb-4 text-center text-lg font-semibold">
          {t("players", { count: players.length })}
        </h2>
        {players.length === 0 ? (
          <p className="text-center text-muted-foreground">{t("waiting")}</p>
        ) : (
          <ul className="flex flex-wrap justify-center gap-3">
            {players.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-full border-2 px-4 py-2"
                style={{ borderColor: p.color }}
              >
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: p.color }}
                  aria-hidden
                />
                <span className="font-medium">{p.name}</span>
                {p.isVip && (
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("vip")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-auto text-xs text-muted-foreground">
        {t(`status.${status}`)}
      </p>
    </main>
  );
}
