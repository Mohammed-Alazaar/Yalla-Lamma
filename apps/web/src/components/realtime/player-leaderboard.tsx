"use client";

import { useTranslations } from "next-intl";
import type { PublicPlayer, PublicRoomState } from "@yalla/shared";
import { rankPlayers } from "@/lib/ranking";
import { Scoreboard } from "./scoreboard";

/** Player's between-question view: own rank plus the top of the board. */
export function PlayerLeaderboard({
  room,
  self,
}: {
  room: PublicRoomState;
  self: PublicPlayer | null;
}) {
  const t = useTranslations("game");
  const myRank = self ? rankPlayers(room.players).find((p) => p.id === self.id)?.rank : undefined;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t("leaderboard")}</h1>
        {myRank != null && (
          <p className="mt-1 text-lg font-semibold text-primary">{t("yourRank", { rank: myRank })}</p>
        )}
      </div>
      <Scoreboard players={room.players} limit={5} highlightId={self?.id} />
    </main>
  );
}
