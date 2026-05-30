"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { PublicPlayer, PublicRoomState } from "@yalla/shared";
import { rankPlayers } from "@/lib/ranking";
import { cn } from "@/lib/utils";

/** Player's per-question feedback: correct/wrong, points gained, current rank. */
export function PlayerReveal({
  room,
  self,
}: {
  room: PublicRoomState;
  self: PublicPlayer | null;
}) {
  const t = useTranslations("game");
  const format = useFormatter();

  const myResult = self ? room.results?.find((r) => r.playerId === self.id) : undefined;
  const answered = myResult != null && myResult.choice !== null;
  const correct = myResult?.correct ?? false;
  const points = myResult?.pointsEarned ?? 0;
  const myRank = self ? rankPlayers(room.players).find((p) => p.id === self.id)?.rank : undefined;

  const tone = correct
    ? "bg-[#26890C]"
    : answered
      ? "bg-[#E21B3C]"
      : "bg-muted-foreground/20";

  return (
    <main
      className={cn(
        "flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center text-white",
        tone,
      )}
    >
      <p className="text-4xl font-extrabold sm:text-5xl">
        {correct ? t("correct") : answered ? t("wrong") : t("noAnswer")}
      </p>
      {correct && (
        <p className="text-3xl font-bold tabular-nums">
          {t("points", { points: format.number(points) })}
        </p>
      )}
      {myRank != null && (
        <p className="rounded-full bg-white/20 px-5 py-2 text-lg font-semibold">
          {t("yourRank", { rank: myRank })}
        </p>
      )}
    </main>
  );
}
