"use client";

import { useTranslations } from "next-intl";
import type { PublicRoomState } from "@yalla/shared";
import { Scoreboard } from "./scoreboard";

/** Between-question standings (top 5) shown on the host screen (PRD GAME-6). */
export function HostLeaderboard({ room }: { room: PublicRoomState }) {
  const t = useTranslations("game");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-6 py-10">
      <h1 className="text-center text-3xl font-extrabold sm:text-4xl">{t("leaderboard")}</h1>
      <Scoreboard players={room.players} limit={5} />
    </main>
  );
}
