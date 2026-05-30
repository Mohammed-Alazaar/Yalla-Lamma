"use client";

import { QRCodeSVG } from "qrcode.react";
import { useLocale, useTranslations } from "next-intl";
import type { PublicRoomState } from "@yalla/shared";
import { PlayerCard } from "./player-card";

export function HostLobby({
  room,
  code,
  origin,
}: {
  room: PublicRoomState | null;
  code: string;
  origin: string;
}) {
  const t = useTranslations("host");
  const locale = useLocale();
  const joinUrl = origin ? `${origin}/${locale}/play/${code}` : "";

  const players = room?.players ?? [];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-10 px-6 py-10">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center sm:gap-12">
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {t("roomCode")}
          </p>
          <p className="font-mono text-7xl font-extrabold tracking-[0.3em] sm:text-8xl">
            {code}
          </p>
          <p className="text-sm text-muted-foreground">{t("scanToJoin")}</p>
        </div>
        {joinUrl && (
          <div className="rounded-2xl bg-white p-4">
            <QRCodeSVG value={joinUrl} size={176} level="M" />
          </div>
        )}
      </div>

      <section className="flex-1">
        <h2 className="mb-4 text-center text-lg font-semibold">
          {t("players", { count: players.length })}
        </h2>
        {players.length === 0 ? (
          <p className="text-center text-muted-foreground">{t("waiting")}</p>
        ) : (
          <ul className="flex flex-wrap justify-center gap-4">
            {players.map((p) => (
              <li key={p.id}>
                <PlayerCard player={p} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
