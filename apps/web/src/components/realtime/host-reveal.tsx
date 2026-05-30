"use client";

import { useTranslations } from "next-intl";
import type { PublicRoomState } from "@yalla/shared";
import { ANSWER_META } from "@/lib/answers";
import { cn } from "@/lib/utils";

/** Host's reveal view: correct choice highlighted, others dimmed, tally per choice. */
export function HostReveal({ room }: { room: PublicRoomState }) {
  const t = useTranslations("game");
  const q = room.question;
  if (!q || q.correctIdx === null) return null;

  const results = room.results ?? [];
  const correctCount = results.filter((r) => r.correct).length;
  const total = room.players.length;

  // Tally how many players picked each choice.
  const tally = [0, 0, 0, 0];
  for (const r of results) {
    if (r.choice !== null && r.choice >= 0 && r.choice < 4) tally[r.choice]! += 1;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <header className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {t("questionProgress", { index: q.index + 1, total: q.total })}
        </p>
        <h1 className="mt-2 text-balance text-2xl font-bold sm:text-3xl">{q.text}</h1>
      </header>

      <p className="text-center text-lg font-medium text-muted-foreground">
        {t("correctCount", { correct: correctCount, total })}
      </p>

      <ul className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
        {q.choices.map((choice, i) => {
          const meta = ANSWER_META[i]!;
          const isCorrect = i === q.correctIdx;
          return (
            <li
              key={i}
              className={cn(
                "flex items-center gap-4 rounded-2xl p-5 text-start text-xl font-semibold text-white transition-opacity",
                !isCorrect && "opacity-30",
              )}
              style={{ backgroundColor: meta.color }}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/25 text-lg font-bold">
                {meta.shape}
              </span>
              <span className="flex-1">{choice}</span>
              {isCorrect && <span aria-hidden className="text-2xl">✓</span>}
              <span className="tabular-nums text-base font-bold">{tally[i]}</span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
