"use client";

import { useFormatter, useTranslations } from "next-intl";
import { FIB_BLANK, type PublicFibOption, type PublicFibState, type PublicRoomState } from "@yalla/shared";
import { useSecondsLeft } from "@/lib/use-countdown";
import { emitWhenReady } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { HostLeaderboard } from "../host-leaderboard";

function Timer({ endsAt }: { endsAt: number }) {
  const secs = useSecondsLeft(endsAt);
  return (
    <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-xl font-bold tabular-nums">
      {secs}
    </span>
  );
}

function letter(i: number): string {
  return String.fromCharCode(65 + i);
}

function Header({ q }: { q: PublicFibState }) {
  const t = useTranslations("fib");
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <span className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        {q.isFinalQuestion
          ? t("finalQuestion")
          : t("question", { index: q.questionIndex + 1, total: q.totalQuestions })}
      </span>
      {(q.phase === "writing" || q.phase === "spotting") && <Timer endsAt={q.phaseEndsAt} />}
    </div>
  );
}

function Prompt({ text }: { text: string }) {
  return (
    <h1 className="text-balance text-center text-3xl font-bold sm:text-4xl" dir="auto">
      {text}
    </h1>
  );
}

function HostFibWriting({ room, q }: { room: PublicRoomState; q: PublicFibState }) {
  const t = useTranslations("fib");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center gap-8 px-6 py-10">
      <Header q={q} />
      <Prompt text={q.promptText} />
      <p className="text-center text-lg font-semibold text-primary">{t("writing.hostHint")}</p>
      <ul className="flex flex-wrap justify-center gap-3">
        {room.players.map((p) => {
          const done = q.writingDone.includes(p.id);
          return (
            <li
              key={p.id}
              className={cn(
                "flex items-center gap-2 rounded-full border px-4 py-2 font-semibold transition-opacity",
                done ? "border-primary" : "opacity-50",
              )}
              style={{ borderColor: done ? undefined : p.color }}
            >
              <span className="size-3 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
              {p.name}
              {done && <span aria-hidden>✓</span>}
            </li>
          );
        })}
      </ul>
    </main>
  );
}

function OptionRow({
  option,
  index,
  reveal,
}: {
  option: PublicFibOption;
  index: number;
  reveal: boolean;
}) {
  const t = useTranslations("fib");
  const format = useFormatter();
  const isTruth = reveal && option.source === "truth";

  let tag: string | null = null;
  if (reveal) {
    if (option.source === "truth") tag = t("reveal.theTruth");
    else if (option.source === "player" && option.authorNames && option.authorNames.length > 0)
      tag = t("reveal.lieBy", { names: option.authorNames.join(", ") });
    else tag = t("reveal.decoy");
  }

  return (
    <li
      className={cn(
        "flex items-center gap-4 rounded-2xl border-2 p-4 transition-colors",
        isTruth ? "border-emerald-500 bg-emerald-500/15" : "border-border bg-card",
        option.voided && "opacity-40",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-lg font-bold">
        {letter(index)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xl font-semibold" dir="auto">
          {option.text}
        </span>
        {tag && <span className="text-sm font-medium text-muted-foreground">{tag}</span>}
      </div>
      {reveal && (
        <span className="shrink-0 text-lg font-bold tabular-nums">
          {t("reveal.picks", { count: format.number(option.pickCount ?? 0) })}
        </span>
      )}
    </li>
  );
}

function HostFibSpotting({ q, reveal }: { q: PublicFibState; reveal: boolean }) {
  const t = useTranslations("fib");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <Header q={q} />
      <Prompt
        text={reveal && q.truthText ? q.promptText.replace(FIB_BLANK, q.truthText) : q.promptText}
      />
      {!reveal && (
        <p className="text-center text-lg font-semibold text-primary">{t("spotting.hostHint")}</p>
      )}
      <ul className="flex flex-col gap-3">
        {q.options.map((o, i) => (
          <div key={o.id} className="flex items-center gap-2">
            <div className="flex-1">
              <OptionRow option={o} index={i} reveal={reveal} />
            </div>
            {!reveal && o.source !== "truth" && !o.voided && (
              <button
                type="button"
                onClick={() => emitWhenReady("host:skipOption", { optionId: o.id })}
                className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
              >
                {t("spotting.skip")}
              </button>
            )}
          </div>
        ))}
      </ul>
      {!reveal && (
        <p className="text-center text-sm text-muted-foreground">
          {t("spotting.picked", { count: q.pickedPlayerIds.length })}
        </p>
      )}
    </main>
  );
}

/** Host fib dispatcher (writing / spotting / reveal / leaderboard). */
export function HostFib({ room }: { room: PublicRoomState }) {
  const f = room.fib;
  if (!f) return null;
  switch (f.phase) {
    case "writing":
      return <HostFibWriting room={room} q={f} />;
    case "spotting":
      return <HostFibSpotting q={f} reveal={false} />;
    case "reveal":
      return <HostFibSpotting q={f} reveal={true} />;
    case "leaderboard":
      return <HostLeaderboard room={room} />;
    default:
      return null;
  }
}
