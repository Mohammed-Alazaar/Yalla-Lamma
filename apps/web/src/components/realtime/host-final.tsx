"use client";

import { useEffect } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { PublicRoomState } from "@yalla/shared";
import { rankPlayers } from "@/lib/ranking";
import { Scoreboard } from "./scoreboard";

const MEDALS = ["🥇", "🥈", "🥉"];

/** Final winner screen: confetti, podium (top 3), and full standings (PRD GAME-8). */
export function HostFinal({ room }: { room: PublicRoomState }) {
  const t = useTranslations("game");
  const format = useFormatter();
  const ranked = rankPlayers(room.players);
  const winners = ranked.filter((p) => p.rank === 1);
  const podium = ranked.slice(0, 3);

  useEffect(() => {
    let cancelled = false;
    void import("canvas-confetti").then((m) => {
      if (cancelled) return;
      const confetti = m.default;
      confetti({ particleCount: 140, spread: 75, origin: { y: 0.3 } });
      setTimeout(() => !cancelled && confetti({ particleCount: 80, spread: 100, origin: { y: 0.4 } }), 350);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center gap-8 px-6 py-10">
      <h1 className="text-center text-4xl font-extrabold sm:text-5xl">
        {winners.length === 1 ? t("winner", { name: winners[0]!.name }) : t("itsATie")}
      </h1>

      <div className="flex w-full items-end justify-center gap-3">
        {podium.map((p) => (
          <div
            key={p.id}
            className="flex flex-1 flex-col items-center gap-2 rounded-2xl border bg-card p-4"
            style={{ marginBottom: p.rank === 1 ? 0 : 16 }}
          >
            <span className="text-3xl" aria-hidden>
              {MEDALS[p.rank - 1] ?? ""}
            </span>
            <span
              className="flex size-12 items-center justify-center rounded-full text-lg font-bold text-white"
              style={{ backgroundColor: p.color }}
              aria-hidden
            >
              {p.name.charAt(0).toUpperCase()}
            </span>
            <span className="max-w-full truncate text-center font-semibold">{p.name}</span>
            <span className="tabular-nums text-sm font-bold text-muted-foreground">
              {t("score", { points: format.number(p.score) })}
            </span>
          </div>
        ))}
      </div>

      <section className="w-full">
        <h2 className="mb-3 text-center text-lg font-semibold">{t("finalScores")}</h2>
        <Scoreboard players={room.players} />
      </section>
    </main>
  );
}
