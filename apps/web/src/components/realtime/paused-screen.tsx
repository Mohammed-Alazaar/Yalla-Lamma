"use client";

import { useTranslations } from "next-intl";

/** Shown while the host is disconnected and the room is in the grace window. */
export function PausedScreen() {
  const t = useTranslations("game.paused");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="size-12 animate-pulse rounded-full bg-primary/30" aria-hidden />
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="max-w-sm text-muted-foreground">{t("subtitle")}</p>
    </main>
  );
}
