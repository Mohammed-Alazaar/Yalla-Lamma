"use client";

import { useTranslations } from "next-intl";
import type { PublicRoomState } from "@yalla/shared";
import { ANSWER_META } from "@/lib/answers";
import { useCountdown } from "@/lib/use-countdown";
import { TimerRing } from "./timer-ring";

/** Host's question view: prompt, timer ring, live answered count, colored choices. */
export function HostQuestion({ room }: { room: PublicRoomState }) {
  const t = useTranslations("game");
  const q = room.question;
  const { remainingSec, fraction } = useCountdown(
    room.questionStartedAt,
    room.settings.timeLimitSec,
  );

  if (!q) return null;
  const answered = room.answeredPlayerIds.length;
  const total = room.players.length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <header className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {t("questionProgress", { index: q.index + 1, total: q.total })}
        </span>
        {q.isFinal && (
          <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">
            {t("doublePoints")}
          </span>
        )}
        <span className="text-sm font-medium text-muted-foreground tabular-nums">
          {t("answeredCount", { answered, total })}
        </span>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <TimerRing seconds={remainingSec} fraction={fraction} />
        <h1 className="text-balance text-3xl font-bold sm:text-4xl md:text-5xl">{q.text}</h1>
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {q.choices.map((choice, i) => {
          const meta = ANSWER_META[i]!;
          return (
            <li
              key={i}
              className="flex items-center gap-4 rounded-2xl p-5 text-start text-xl font-semibold text-white"
              style={{ backgroundColor: meta.color }}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/25 text-lg font-bold">
                {meta.shape}
              </span>
              <span>{choice}</span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
