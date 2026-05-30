"use client";

import { QRCodeSVG } from "qrcode.react";
import { useLocale, useTranslations } from "next-intl";
import type { PublicRoomState } from "@yalla/shared";
import { emitWhenReady } from "@/lib/socket";
import { PlayerCard } from "./player-card";
import { GamePicker } from "./game-picker";

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

      {room?.gameId == null && (
        <div className="flex justify-center">
          <GamePicker selected={null} interactive={false} />
        </div>
      )}

      <section className="flex-1">
        <div className="mb-4 flex items-center justify-center gap-4">
          <h2 className="text-lg font-semibold">{t("players", { count: players.length })}</h2>
          {players.length > 0 && (
            <button
              type="button"
              onClick={() => emitWhenReady("host:lock", { locked: !room?.locked })}
              aria-pressed={room?.locked ?? false}
              className="rounded-full border px-3 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
            >
              {room?.locked ? t("unlock") : t("lock")}
            </button>
          )}
        </div>
        {players.length === 0 ? (
          <p className="text-center text-muted-foreground">{t("waiting")}</p>
        ) : (
          <ul className="flex flex-wrap justify-center gap-4">
            {players.map((p) => (
              <li key={p.id}>
                <PlayerCard
                  player={p}
                  onKick={(id) => emitWhenReady("host:kick", { playerId: id })}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
