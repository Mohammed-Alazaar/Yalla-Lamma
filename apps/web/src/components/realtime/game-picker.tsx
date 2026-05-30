"use client";

import { useTranslations } from "next-intl";
import type { GameId } from "@yalla/shared";
import { emitWhenReady } from "@/lib/socket";
import { cn } from "@/lib/utils";

const GAMES: { id: GameId; accent: string }[] = [
  { id: "trivia", accent: "#3B82F6" },
  { id: "quip", accent: "#EC4899" },
];

/**
 * Lobby game-picker (SEL-1..4). Interactive for the VIP (taps select the game);
 * a read-only display on the host screen and for non-VIP players.
 */
export function GamePicker({
  selected,
  interactive,
}: {
  selected: GameId | null;
  interactive: boolean;
}) {
  const t = useTranslations("games");

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <h2 className="text-center text-lg font-semibold">
        {interactive ? t("choose") : t("vipChoosing")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {GAMES.map((g) => {
          const isSel = selected === g.id;
          const Tag = interactive ? "button" : "div";
          return (
            <Tag
              key={g.id}
              {...(interactive
                ? {
                    type: "button" as const,
                    onClick: () => emitWhenReady("vip:selectGame", { gameId: g.id }),
                    "aria-pressed": isSel,
                  }
                : {})}
              className={cn(
                "flex flex-col gap-1 rounded-2xl border-2 bg-card p-4 text-start transition-colors",
                isSel ? "border-primary" : "border-border",
                interactive && "hover:bg-accent",
              )}
              style={isSel ? undefined : { borderColor: `${g.accent}66` }}
            >
              <span className="text-lg font-bold">{t(`${g.id}.name`)}</span>
              <span className="text-xs font-medium text-muted-foreground">{t(`${g.id}.players`)}</span>
              <span className="text-sm text-muted-foreground">{t(`${g.id}.desc`)}</span>
            </Tag>
          );
        })}
      </div>
    </div>
  );
}
