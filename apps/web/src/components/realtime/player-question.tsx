"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { PublicPlayer, PublicRoomState } from "@yalla/shared";
import { ANSWER_META } from "@/lib/answers";
import { emitWhenReady } from "@/lib/socket";

/**
 * Player's answer pad — four big colored buttons, NO question text (PRD GAME-1).
 * Locks after one tap (PRD GAME-3). Mount with key={questionId} to reset.
 */
export function PlayerQuestion({
  room,
  self,
}: {
  room: PublicRoomState;
  self: PublicPlayer | null;
}) {
  const t = useTranslations("game");
  const q = room.question;
  const [picked, setPicked] = useState<number | null>(null);

  if (!q) return null;
  const alreadyAnswered = self != null && room.answeredPlayerIds.includes(self.id);
  const locked = picked !== null || alreadyAnswered;

  function answer(choice: number) {
    if (locked || !q) return;
    setPicked(choice);
    emitWhenReady("player:answer", { questionId: q.id, choice });
  }

  if (locked) {
    const meta = picked !== null ? ANSWER_META[picked]! : null;
    const color = meta?.color ?? self?.color ?? "#666";
    return (
      <main
        className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center"
        style={{ backgroundColor: `${color}1a` }}
      >
        <div
          className="flex size-28 items-center justify-center rounded-3xl text-5xl font-bold text-white"
          style={{ backgroundColor: color }}
          aria-hidden
        >
          {meta ? meta.shape : "✓"}
        </div>
        <p className="text-2xl font-bold">{t("lockedIn")}</p>
        <p className="text-muted-foreground">{t("answeredWaiting")}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col gap-3 p-3">
      <p className="text-center text-sm font-medium text-muted-foreground">{t("tapToAnswer")}</p>
      <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-3">
        {q.choices.map((_, i) => {
          const meta = ANSWER_META[i]!;
          return (
            <button
              key={i}
              type="button"
              onClick={() => answer(i)}
              className="flex items-center justify-center rounded-3xl text-5xl font-extrabold text-white transition-transform active:scale-95"
              style={{ backgroundColor: meta.color }}
              aria-label={t("answerLabel", { letter: meta.label })}
            >
              <span aria-hidden>{meta.shape}</span>
            </button>
          );
        })}
      </div>
    </main>
  );
}
