"use client";

import { useTranslations } from "next-intl";
import {
  MIN_PLAYERS_TO_START,
  QUIP_ANSWER_TIME_OPTIONS,
  QUIP_ROUNDS_OPTIONS,
  QUIP_VOTE_TIME_OPTIONS,
  type PublicRoomState,
  type QuipSettings,
} from "@yalla/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { emitWhenReady } from "@/lib/socket";

function Choice<T extends string | number>({
  legend,
  options,
  value,
  onSelect,
  format,
}: {
  legend: string;
  options: readonly T[];
  value: T;
  onSelect: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-muted-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={String(o)}
            type="button"
            aria-pressed={o === value}
            onClick={() => onSelect(o)}
            className={cn(
              "min-h-11 rounded-lg border px-4 text-sm font-semibold transition-colors",
              o === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-secondary text-secondary-foreground hover:bg-accent",
            )}
          >
            {format ? format(o) : o}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onToggle(!on)}
      className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-border bg-secondary px-4 text-sm font-semibold"
    >
      <span>{label}</span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          on ? "bg-primary" : "bg-muted-foreground/40",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white transition-all",
            on ? "start-[22px]" : "start-0.5",
          )}
        />
      </span>
    </button>
  );
}

/** VIP QuipParty configuration + start (QSET-1..5). */
export function QuipSettingsPanel({ room }: { room: PublicRoomState }) {
  const t = useTranslations("quipControls");
  const s = room.quipSettings;
  const canStart = room.players.length >= MIN_PLAYERS_TO_START;

  function configure(patch: Partial<QuipSettings>) {
    emitWhenReady("vip:configureQuip", { ...s, ...patch });
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <Choice
        legend={t("rounds")}
        options={QUIP_ROUNDS_OPTIONS}
        value={s.totalRounds as (typeof QUIP_ROUNDS_OPTIONS)[number]}
        onSelect={(totalRounds) => configure({ totalRounds })}
      />
      <Choice
        legend={t("answerTime")}
        options={QUIP_ANSWER_TIME_OPTIONS}
        value={s.answerTimeSec as (typeof QUIP_ANSWER_TIME_OPTIONS)[number]}
        onSelect={(answerTimeSec) => configure({ answerTimeSec })}
        format={(v) => t("seconds", { count: v })}
      />
      <Choice
        legend={t("voteTime")}
        options={QUIP_VOTE_TIME_OPTIONS}
        value={s.voteTimeSec as (typeof QUIP_VOTE_TIME_OPTIONS)[number]}
        onSelect={(voteTimeSec) => configure({ voteTimeSec })}
        format={(v) => t("seconds", { count: v })}
      />
      <Toggle label={t("familyFriendly")} on={s.familyFriendly} onToggle={(familyFriendly) => configure({ familyFriendly })} />
      <Toggle label={t("audienceVoting")} on={s.audienceVoting} onToggle={(audienceVoting) => configure({ audienceVoting })} />

      <Button
        size="lg"
        className="min-h-12 text-base"
        disabled={!canStart}
        onClick={() => emitWhenReady("vip:start")}
      >
        {t("start")}
      </Button>
      {!canStart && (
        <p className="text-center text-sm text-muted-foreground">{t("needMore", { min: MIN_PLAYERS_TO_START })}</p>
      )}
      <button
        type="button"
        onClick={() => emitWhenReady("vip:changeGame")}
        className="text-sm text-muted-foreground underline-offset-2 hover:underline"
      >
        {t("changeGame")}
      </button>
    </div>
  );
}
