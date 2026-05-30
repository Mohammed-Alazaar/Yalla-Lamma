"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { PublicQuipState, PublicRoomState } from "@yalla/shared";
import { ANSWER_META } from "@/lib/answers";
import { useSecondsLeft } from "@/lib/use-countdown";
import { emitWhenReady } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { HostLeaderboard } from "../host-leaderboard";

const OPTION = [ANSWER_META[0], ANSWER_META[1]] as const; // red / blue

function Timer({ endsAt }: { endsAt: number }) {
  const secs = useSecondsLeft(endsAt);
  return (
    <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-xl font-bold tabular-nums">
      {secs}
    </span>
  );
}

function HostQuipWriting({ room, q }: { room: PublicRoomState; q: PublicQuipState }) {
  const t = useTranslations("quip");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center gap-8 px-6 py-10">
      <div className="flex w-full items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {t("round", { round: q.round, total: q.totalRounds })}
        </span>
        <Timer endsAt={q.phaseEndsAt} />
      </div>
      <h1 className="text-balance text-center text-3xl font-bold sm:text-4xl">{t("writing.title")}</h1>
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

function AnswerTile({
  index,
  text,
  reveal,
  votes,
  points,
  dim,
}: {
  index: 0 | 1;
  text: string;
  reveal: boolean;
  votes?: number;
  points?: number;
  dim?: boolean;
}) {
  const t = useTranslations("quip");
  const format = useFormatter();
  const meta = OPTION[index]!;
  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-3 rounded-2xl p-5 text-white transition-opacity",
        dim && "opacity-40",
      )}
      style={{ backgroundColor: meta.color }}
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-white/25 text-lg font-bold">
        {meta.shape}
      </span>
      <p className="text-xl font-semibold" dir="auto">
        {text}
      </p>
      {reveal && (
        <div className="mt-auto flex items-center justify-between text-lg font-bold tabular-nums">
          <span>{t("reveal.votes", { count: votes ?? 0 })}</span>
          {points != null && <span>+{format.number(points)}</span>}
        </div>
      )}
    </div>
  );
}

function HostQuipMatchup({ q, reveal }: { q: PublicQuipState; reveal: boolean }) {
  const t = useTranslations("quip");
  const m = q.matchup;
  if (!m) return null;
  const counts = m.voteCounts;
  const sweep =
    reveal && counts != null && (counts[0] === 0 || counts[1] === 0) && counts[0] + counts[1] > 0;
  const winner = counts ? (counts[0] >= counts[1] ? 0 : 1) : 0;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {t("matchup", { index: q.matchupIndex + 1, total: q.matchupTotal })}
        </span>
        {!reveal && <Timer endsAt={q.phaseEndsAt} />}
      </div>
      <h1 className="text-balance text-center text-2xl font-bold sm:text-3xl" dir="auto">
        {m.promptText}
      </h1>
      {m.voided ? (
        <p className="text-center text-lg font-semibold text-muted-foreground">{t("reveal.skipped")}</p>
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row">
            <AnswerTile index={0} text={m.answers[0]} reveal={reveal} votes={m.voteCounts?.[0]} points={m.pointsEarned?.[0]} dim={reveal && sweep && winner !== 0} />
            <AnswerTile index={1} text={m.answers[1]} reveal={reveal} votes={m.voteCounts?.[1]} points={m.pointsEarned?.[1]} dim={reveal && sweep && winner !== 1} />
          </div>
          {reveal && sweep && (
            <p className="text-center text-2xl font-extrabold text-primary">{t("reveal.quiplash")}</p>
          )}
        </>
      )}
      {!reveal && (
        <button
          type="button"
          onClick={() => emitWhenReady("host:skipAnswer", { matchupIndex: q.matchupIndex })}
          className="mx-auto rounded-full border px-4 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent"
        >
          {t("voting.skip")}
        </button>
      )}
    </main>
  );
}

/** Host quip dispatcher (writing / voting / reveal / leaderboard). */
export function HostQuip({ room }: { room: PublicRoomState }) {
  const q = room.quip;
  if (!q) return null;
  switch (q.phase) {
    case "writing":
      return <HostQuipWriting room={room} q={q} />;
    case "voting":
      return <HostQuipMatchup q={q} reveal={false} />;
    case "reveal":
      return <HostQuipMatchup q={q} reveal={true} />;
    case "leaderboard":
      return <HostLeaderboard room={room} />;
    default:
      return null;
  }
}
