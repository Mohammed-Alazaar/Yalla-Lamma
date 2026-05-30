"use client";

import { useTranslations } from "next-intl";
import type { PublicPlayer, PublicRoomState } from "@yalla/shared";
import { rankPlayers } from "@/lib/ranking";
import { Button } from "@/components/ui/button";
import { emitWhenReady } from "@/lib/socket";
import { Scoreboard } from "./scoreboard";

/** Player's end screen: own placement, the winner, and a VIP-only replay button. */
export function PlayerFinal({
  room,
  self,
}: {
  room: PublicRoomState;
  self: PublicPlayer | null;
}) {
  const t = useTranslations("game");
  const ranked = rankPlayers(room.players);
  const winners = ranked.filter((p) => p.rank === 1);
  const myRank = self ? ranked.find((p) => p.id === self.id)?.rank : undefined;
  const isVip = self?.isVip ?? false;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center gap-6 px-6 py-10 text-center">
      <h1 className="text-3xl font-extrabold">
        {winners.length === 1 ? t("winner", { name: winners[0]!.name }) : t("itsATie")}
      </h1>
      {myRank != null && (
        <p className="rounded-full bg-primary/15 px-5 py-2 text-lg font-semibold text-primary">
          {t("yourRank", { rank: myRank })}
        </p>
      )}

      <Scoreboard players={room.players} highlightId={self?.id} />

      {isVip && (
        <Button size="lg" className="mt-2 min-h-12 w-full text-base" onClick={() => emitWhenReady("vip:playAgain")}>
          {t("playAgain")}
        </Button>
      )}
    </main>
  );
}
