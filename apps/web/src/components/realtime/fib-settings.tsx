"use client";

import { useTranslations } from "next-intl";
import {
  FIB_LIE_TIME_OPTIONS,
  FIB_MIN_PLAYERS,
  FIB_QUESTIONS_OPTIONS,
  FIB_SPOT_TIME_OPTIONS,
  type CategoryName,
  type FibSettings,
  type PublicRoomState,
} from "@yalla/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { emitWhenReady } from "@/lib/socket";

// Only categories that actually have facts in the bundled bank are offered.
const FIB_CATEGORIES: readonly CategoryName[] = ["General", "Science", "History", "Pop Culture"];

const CATEGORY_KEY: Record<string, string> = {
  General: "general",
  Science: "science",
  History: "history",
  "Pop Culture": "popCulture",
};

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

/** VIP FibParty configuration + start (FSET-1..5). */
export function FibSettingsPanel({ room }: { room: PublicRoomState }) {
  const t = useTranslations("fibControls");
  const s = room.fibSettings;
  const canStart = room.players.length >= FIB_MIN_PLAYERS;

  function configure(patch: Partial<FibSettings>) {
    emitWhenReady("vip:configureFib", { ...s, ...patch });
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <Choice
        legend={t("questions")}
        options={FIB_QUESTIONS_OPTIONS}
        value={s.totalQuestions as (typeof FIB_QUESTIONS_OPTIONS)[number]}
        onSelect={(totalQuestions) => configure({ totalQuestions })}
      />
      <Choice
        legend={t("category")}
        options={FIB_CATEGORIES}
        value={s.category}
        onSelect={(category) => configure({ category })}
        format={(c) => t(`categories.${CATEGORY_KEY[c] ?? "general"}`)}
      />
      <Choice
        legend={t("lieTime")}
        options={FIB_LIE_TIME_OPTIONS}
        value={s.lieTimeSec as (typeof FIB_LIE_TIME_OPTIONS)[number]}
        onSelect={(lieTimeSec) => configure({ lieTimeSec })}
        format={(v) => t("seconds", { count: v })}
      />
      <Choice
        legend={t("spotTime")}
        options={FIB_SPOT_TIME_OPTIONS}
        value={s.spotTimeSec as (typeof FIB_SPOT_TIME_OPTIONS)[number]}
        onSelect={(spotTimeSec) => configure({ spotTimeSec })}
        format={(v) => t("seconds", { count: v })}
      />
      <Toggle
        label={t("familyFriendly")}
        on={s.familyFriendly}
        onToggle={(familyFriendly) => configure({ familyFriendly })}
      />

      <Button
        size="lg"
        className="min-h-12 text-base"
        disabled={!canStart}
        onClick={() => emitWhenReady("vip:start")}
      >
        {t("start")}
      </Button>
      {!canStart && (
        <p className="text-center text-sm text-muted-foreground">
          {t("needMore", { min: FIB_MIN_PLAYERS })}
        </p>
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
