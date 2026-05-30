"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  QUIP_ANSWER_MAX,
  type PublicPlayer,
  type PublicQuipState,
  type PublicRoomState,
  type QuipAnswerRejectedPayload,
} from "@yalla/shared";
import { ANSWER_META } from "@/lib/answers";
import { rankPlayers } from "@/lib/ranking";
import { useSecondsLeft } from "@/lib/use-countdown";
import { emitWhenReady, getSocket } from "@/lib/socket";
import { PlayerLeaderboard } from "../player-leaderboard";

const OPTION = [ANSWER_META[0], ANSWER_META[1]] as const;

const inputClass =
  "min-h-24 w-full rounded-md border border-input bg-background p-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function PlayerQuipWriting({ q, self }: { q: PublicQuipState; self: PublicPlayer | null }) {
  const t = useTranslations("quip");
  const assigned = self ? (q.assignments[self.id] ?? []) : [];
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = getSocket();
    const onRejected = (p: QuipAnswerRejectedPayload) => {
      setError(t(`rejected.${p.reason}`));
      setSubmitted((prev) => prev.filter((id) => id !== p.promptId)); // roll back
    };
    s.on("quip:answerRejected", onRejected);
    return () => {
      s.off("quip:answerRejected", onRejected);
    };
  }, [t]);

  const current = assigned.find((id) => !submitted.includes(id));
  const waiting = !current || (self != null && q.writingDone.includes(self.id));

  if (waiting) {
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
    if (!trimmed || !current) {
      setError(t("rejected.empty"));
      return;
    }
    setError(null);
    emitWhenReady("quip:submitAnswer", { promptId: current, text: trimmed });
    setSubmitted((prev) => [...prev, current]);
    setText("");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {t("writing.prompt", { index: assigned.indexOf(current) + 1, total: assigned.length })}
      </p>
      <h1 className="text-balance text-xl font-bold" dir="auto">
        {q.promptTexts[current] ?? ""}
      </h1>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={QUIP_ANSWER_MAX}
          autoFocus
          dir="auto"
          placeholder={t("writing.placeholder")}
          className={inputClass}
        />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("writing.counter", { count: text.length, max: QUIP_ANSWER_MAX })}</span>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
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

function PlayerQuipVoting({ q, self }: { q: PublicQuipState; self: PublicPlayer | null }) {
  const t = useTranslations("quip");
  // Keyed by matchupIndex in the dispatcher, so this remounts (and resets) per
  // matchup — no effect needed to clear the latch.
  const [voted, setVoted] = useState(false);
  const secs = useSecondsLeft(q.phaseEndsAt);
  const m = q.matchup;

  if (!m || !self) return null;
  const isAuthor = m.viewerSide !== null;
  const hasVoted = voted || q.votedPlayerIds.includes(self.id);

  if (isAuthor) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-2xl font-bold">{t("voting.yours")}</p>
        <p className="text-muted-foreground">{t("voting.sitTight")}</p>
      </main>
    );
  }
  if (hasVoted || m.voided) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-2xl font-bold">{m.voided ? t("reveal.skipped") : t("voting.locked")}</p>
        <p className="text-muted-foreground">{t("voting.waiting")}</p>
      </main>
    );
  }

  function vote(choice: 0 | 1) {
    setVoted(true);
    emitWhenReady("quip:vote", { matchupIndex: q.matchupIndex, choice });
  }

  return (
    <main className="flex min-h-dvh flex-col gap-3 p-3">
      <p className="text-center text-sm font-medium text-muted-foreground">
        {t("voting.pick")} · {secs}
      </p>
      <div className="grid flex-1 grid-rows-2 gap-3">
        {([0, 1] as const).map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => vote(i)}
            dir="auto"
            className="flex items-center justify-center rounded-3xl p-5 text-center text-lg font-bold text-white transition-transform active:scale-95"
            style={{ backgroundColor: OPTION[i]!.color }}
          >
            {m.answers[i]}
          </button>
        ))}
      </div>
    </main>
  );
}

function PlayerQuipReveal({ room, q, self }: { room: PublicRoomState; q: PublicQuipState; self: PublicPlayer | null }) {
  const t = useTranslations("quip");
  const format = useFormatter();
  const m = q.matchup;
  const myRank = self ? rankPlayers(room.players).find((p) => p.id === self.id)?.rank : undefined;

  let mine: { won: boolean; points: number } | null = null;
  if (m && m.voteCounts && m.pointsEarned && m.viewerSide !== null) {
    const side = m.viewerSide;
    const other = side === 0 ? 1 : 0;
    mine = { won: m.voteCounts[side] >= m.voteCounts[other], points: m.pointsEarned[side] };
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      {mine ? (
        <>
          <p className="text-3xl font-extrabold">{mine.won ? t("reveal.youWon") : t("reveal.youLost")}</p>
          <p className="text-2xl font-bold tabular-nums">+{format.number(mine.points)}</p>
        </>
      ) : (
        <p className="text-2xl font-bold">{t("reveal.votesIn")}</p>
      )}
      {myRank != null && (
        <p className="rounded-full bg-primary/15 px-5 py-2 text-lg font-semibold text-primary">
          {t("reveal.yourRank", { rank: myRank })}
        </p>
      )}
    </main>
  );
}

/** Player quip dispatcher (writing / voting / reveal / leaderboard). */
export function PlayerQuip({ room, self }: { room: PublicRoomState; self: PublicPlayer | null }) {
  const q = room.quip;
  if (!q) return null;
  switch (q.phase) {
    case "writing":
      return <PlayerQuipWriting q={q} self={self} />;
    case "voting":
      return <PlayerQuipVoting key={q.matchupIndex} q={q} self={self} />;
    case "reveal":
      return <PlayerQuipReveal room={room} q={q} self={self} />;
    case "leaderboard":
      return <PlayerLeaderboard room={room} self={self} />;
    default:
      return null;
  }
}
