"use client";

import { useFormatter, useTranslations } from "next-intl";
import { rankPlayers, type RankedPlayer } from "@/lib/ranking";
import type { PublicPlayer } from "@yalla/shared";
import { cn } from "@/lib/utils";

/** Ranked score list, shared by the leaderboard and final standings. */
export function Scoreboard({
  players,
  limit,
  highlightId,
}: {
  players: PublicPlayer[];
  limit?: number;
  highlightId?: string | null;
}) {
  const t = useTranslations("game");
  const format = useFormatter();
  const ranked: RankedPlayer[] = rankPlayers(players);
  const shown = limit ? ranked.slice(0, limit) : ranked;

  return (
    <ol className="flex w-full flex-col gap-2">
      {shown.map((p) => (
        <li
          key={p.id}
          className={cn(
            "flex items-center gap-4 rounded-xl border bg-card p-3",
            p.id === highlightId && "ring-2 ring-primary",
          )}
        >
          <span className="w-8 shrink-0 text-center text-lg font-bold tabular-nums text-muted-foreground">
            {format.number(p.rank)}
          </span>
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: p.color }}
            aria-hidden
          >
            {p.name.charAt(0).toUpperCase()}
          </span>
          <span className="flex-1 truncate font-semibold">{p.name}</span>
          <span className="tabular-nums font-bold">
            {t("score", { points: format.number(p.score) })}
          </span>
        </li>
      ))}
    </ol>
  );
}
