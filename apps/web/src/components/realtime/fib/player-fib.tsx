"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  FIB_LIE_MAX,
  type FibLieRejectedPayload,
  type PublicFibState,
  type PublicPlayer,
  type PublicRoomState,
} from "@yalla/shared";
import { rankPlayers } from "@/lib/ranking";
import { useSecondsLeft } from "@/lib/use-countdown";
import { emitWhenReady, getSocket } from "@/lib/socket";
import { PlayerLeaderboard } from "../player-leaderboard";

function letter(i: number): string {
  return String.fromCharCode(65 + i);
}

const inputClass =
  "min-h-20 w-full rounded-md border border-input bg-background p-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function PlayerFibWriting({ q, self }: { q: PublicFibState; self: PublicPlayer | null }) {
  const t = useTranslations("fib");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const s = getSocket();
    const onRejected = (p: FibLieRejectedPayload) => {
      setError(t(`rejected.${p.reason}`));
      setSubmitted(false); // roll back so they can retry
    };
    s.on("fib:lieRejected", onRejected);
    return () => {
      s.off("fib:lieRejected", onRejected);
    };
  }, [t]);

  const done = submitted || (self != null && q.writingDone.includes(self.id));
  if (done) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-2xl font-bold">{t("writing.locked")}</p>
        <p className="text-muted-foreground">{t("writing.waiting")}</p>
      </main>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setError(t("rejected.empty"));
      return;
    }
    setError(null);
    setSubmitted(true);
    emitWhenReady("fib:submitLie", { factId: q.factId, text: trimmed });
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {t("writing.label")}
      </p>
      <h1 className="text-balance text-xl font-bold" dir="auto">
        {q.promptText}
      </h1>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={FIB_LIE_MAX}
          autoFocus
          dir="auto"
          placeholder={t("writing.placeholder")}
          className={inputClass}
        />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("writing.counter", { count: text.length, max: FIB_LIE_MAX })}</span>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={text.trim().length === 0}
          className="min-h-12 rounded-md bg-primary text-base font-semibold text-primary-foreground disabled:opacity-50"
        >
          {t("writing.submit")}
        </button>
      </form>
    </main>
  );
}

function PlayerFibSpotting({ q, self }: { q: PublicFibState; self: PublicPlayer | null }) {
  const t = useTranslations("fib");
  const [picked, setPicked] = useState(false);
  const secs = useSecondsLeft(q.phaseEndsAt);

  if (!self) return null;
  const hasPicked = picked || q.pickedPlayerIds.includes(self.id);

  if (hasPicked) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-2xl font-bold">{t("spotting.locked")}</p>
        <p className="text-muted-foreground">{t("spotting.waiting")}</p>
      </main>
    );
  }

  function pick(optionId: string) {
    setPicked(true);
    emitWhenReady("fib:pick", { optionId });
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 p-3">
      <p className="text-center text-sm font-medium text-muted-foreground">
        {t("spotting.pick")} · {secs}
      </p>
      <div className="flex flex-1 flex-col gap-3">
        {q.options
          .filter((o) => !o.voided)
          .map((o, i) => (
            <button
              key={o.id}
              type="button"
              disabled={o.isOwnLie}
              onClick={() => pick(o.id)}
              dir="auto"
              className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4 text-start text-lg font-semibold transition-transform active:scale-95 disabled:opacity-40"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-base font-bold">
                {letter(i)}
              </span>
              <span className="min-w-0 flex-1">{o.text}</span>
              {o.isOwnLie && (
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {t("spotting.yourLie")}
                </span>
              )}
            </button>
          ))}
      </div>
    </main>
  );
}

function PlayerFibReveal({
  room,
  q,
  self,
}: {
  room: PublicRoomState;
  q: PublicFibState;
  self: PublicPlayer | null;
}) {
  const t = useTranslations("fib");
  const format = useFormatter();
  const r = q.viewerResult;
  const myRank = self ? rankPlayers(room.players).find((p) => p.id === self.id)?.rank : undefined;
  const total = (r?.truthPoints ?? 0) + (r?.foolPoints ?? 0);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-3xl font-extrabold">
        {r?.foundTruth ? t("reveal.youFound") : t("reveal.youMissed")}
      </p>
      {r && r.fooled > 0 && (
        <p className="text-lg font-semibold text-primary">{t("reveal.youFooled", { count: r.fooled })}</p>
      )}
      <p className="text-2xl font-bold tabular-nums">+{format.number(total)}</p>
      {myRank != null && (
        <p className="rounded-full bg-primary/15 px-5 py-2 text-lg font-semibold text-primary">
          {t("reveal.yourRank", { rank: myRank })}
        </p>
      )}
    </main>
  );
}

/** Player fib dispatcher (writing / spotting / reveal / leaderboard). */
export function PlayerFib({ room, self }: { room: PublicRoomState; self: PublicPlayer | null }) {
  const f = room.fib;
  if (!f) return null;
  switch (f.phase) {
    case "writing":
      return <PlayerFibWriting key={f.questionIndex} q={f} self={self} />;
    case "spotting":
      return <PlayerFibSpotting key={f.questionIndex} q={f} self={self} />;
    case "reveal":
      return <PlayerFibReveal room={room} q={f} self={self} />;
    case "leaderboard":
      return <PlayerLeaderboard room={room} self={self} />;
    default:
      return null;
  }
}
