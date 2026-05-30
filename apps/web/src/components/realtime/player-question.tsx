"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { PublicPlayer, PublicRoomState } from "@yalla/shared";
import { ANSWER_META } from "@/lib/answers";
import { useCountdown } from "@/lib/use-countdown";
import { emitWhenReady } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Player's answer screen: shows the question + the four answer texts, lets the
 * player pick (and change) a choice, then commit with "Lock answer". When the
 * countdown runs out, the current selection is auto-submitted; no selection
 * means no answer (the server scores it 0). Mount with key={questionId}.
 */
export function PlayerQuestion({
  room,
  self,
}: {
  room: PublicRoomState;
  self: PublicPlayer | null;
}) {
  const t = useTranslations("game");
  const format = useFormatter();
  const q = room.question;
  const [selected, setSelected] = useState<number | null>(null);
  const [committed, setCommitted] = useState<number | null>(null);
  const submittedRef = useRef(false);

  const { remainingSec, expired } = useCountdown(
    room.questionStartedAt,
    room.settings.timeLimitSec,
  );
  const alreadyAnswered = self != null && q != null && room.answeredPlayerIds.includes(self.id);
  const locked = committed !== null || alreadyAnswered || expired;

  function lockIn() {
    if (selected === null || locked || submittedRef.current || !q) return;
    submittedRef.current = true;
    setCommitted(selected);
    emitWhenReady("player:answer", { questionId: q.id, choice: selected });
  }

  // Time's up → auto-submit the current selection. No setState here: `expired`
  // already flips the UI to locked; a ref dedupes the emit.
  useEffect(() => {
    if (expired && !submittedRef.current && selected !== null && q) {
      submittedRef.current = true;
      emitWhenReady("player:answer", { questionId: q.id, choice: selected });
    }
  }, [expired, selected, q]);

  if (!q) return null;

  const chosen = committed ?? selected;

  if (locked) {
    const meta = chosen !== null ? ANSWER_META[chosen]! : null;
    return (
      <main
        className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center"
        style={meta ? { backgroundColor: `${meta.color}1a` } : undefined}
      >
        {meta && (
          <div
            className="flex w-full max-w-sm items-center gap-3 rounded-2xl p-4 text-start text-lg font-semibold text-white"
            style={{ backgroundColor: meta.color }}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/25 font-bold">
              {meta.shape}
            </span>
            <span>{q.choices[chosen!]}</span>
          </div>
        )}
        <p className="text-2xl font-bold">{chosen !== null ? t("lockedIn") : t("noAnswer")}</p>
        <p className="text-muted-foreground">{t("answeredWaiting")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("questionProgress", { index: q.index + 1, total: q.total })}
        </p>
        <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-bold tabular-nums">
          {format.number(remainingSec)}
        </span>
      </div>

      <h1 className="text-balance text-xl font-bold">{q.text}</h1>

      <div className="flex flex-1 flex-col gap-3">
        {q.choices.map((choice, i) => {
          const meta = ANSWER_META[i]!;
          const isSelected = selected === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(i)}
              aria-pressed={isSelected}
              className={cn(
                "flex items-center gap-3 rounded-2xl p-4 text-start text-base font-semibold text-white transition-transform",
                isSelected ? "scale-[1.02] ring-4 ring-white" : "opacity-80",
              )}
              style={{ backgroundColor: meta.color }}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/25 font-bold">
                {meta.shape}
              </span>
              <span>{choice}</span>
            </button>
          );
        })}
      </div>

      <Button
        size="lg"
        className="min-h-12 text-base"
        disabled={selected === null}
        onClick={lockIn}
      >
        {t("lockAnswer")}
      </Button>
    </main>
  );
}
