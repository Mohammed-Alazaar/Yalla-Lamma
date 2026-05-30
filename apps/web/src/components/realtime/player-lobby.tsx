"use client";

import { useTranslations } from "next-intl";
import {
  CATEGORIES,
  COUNTRIES,
  MIN_PLAYERS_TO_START,
  NUM_QUESTIONS_OPTIONS,
  TIME_LIMIT_OPTIONS,
  type CategoryName,
  type CountryName,
  type PublicPlayer,
  type PublicRoomState,
} from "@yalla/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { emitWhenReady } from "@/lib/socket";
import { GamePicker } from "./game-picker";
import { QuipSettingsPanel } from "./quip-settings";

const CATEGORY_KEY: Record<string, string> = {
  General: "general",
  Science: "science",
  History: "history",
  "Pop Culture": "popCulture",
  Sports: "sports",
};

const COUNTRY_KEY: Record<string, string> = {
  General: "general",
  Algeria: "algeria",
  Palestine: "palestine",
  Syria: "syria",
};

function SettingGroup<T extends string | number>({
  legend,
  options,
  value,
  onSelect,
  format,
}: {
  legend: string;
  options: readonly T[];
  value: T;
  onSelect: (value: T) => void;
  format?: (value: T) => string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-muted-foreground">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={String(option)}
            type="button"
            aria-pressed={option === value}
            onClick={() => onSelect(option)}
            className={cn(
              "min-h-11 rounded-lg border px-4 text-sm font-semibold transition-colors",
              option === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-secondary text-secondary-foreground hover:bg-accent",
            )}
          >
            {format ? format(option) : option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function VipControls({ room }: { room: PublicRoomState }) {
  const t = useTranslations("vipControls");
  const { settings } = room;
  const playerCount = room.players.length;
  const canStart = playerCount >= MIN_PLAYERS_TO_START;

  function configure(patch: Partial<typeof settings>) {
    emitWhenReady("vip:configure", {
      country: (patch.country ?? settings.country) as CountryName,
      category: (patch.category ?? settings.category) as CategoryName,
      numQuestions: patch.numQuestions ?? settings.numQuestions,
      timeLimitSec: patch.timeLimitSec ?? settings.timeLimitSec,
    });
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <SettingGroup
        legend={t("country")}
        options={COUNTRIES}
        value={settings.country as CountryName}
        onSelect={(country) => configure({ country })}
        format={(c) => t(`countries.${COUNTRY_KEY[c] ?? "general"}`)}
      />
      <SettingGroup
        legend={t("questions")}
        options={NUM_QUESTIONS_OPTIONS}
        value={settings.numQuestions as (typeof NUM_QUESTIONS_OPTIONS)[number]}
        onSelect={(numQuestions) => configure({ numQuestions })}
      />
      <SettingGroup
        legend={t("category")}
        options={CATEGORIES}
        value={settings.category as CategoryName}
        onSelect={(category) => configure({ category })}
        format={(c) => t(`categories.${CATEGORY_KEY[c] ?? "general"}`)}
      />
      <SettingGroup
        legend={t("time")}
        options={TIME_LIMIT_OPTIONS}
        value={settings.timeLimitSec as (typeof TIME_LIMIT_OPTIONS)[number]}
        onSelect={(timeLimitSec) => configure({ timeLimitSec })}
        format={(s) => t("seconds", { count: s })}
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
          {t("needMore", { min: MIN_PLAYERS_TO_START })}
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

export function PlayerLobby({
  room,
  self,
}: {
  room: PublicRoomState;
  self: PublicPlayer | null;
}) {
  const t = useTranslations("play");
  const isVip = self?.isVip ?? false;
  const others = room.players.filter((p) => p.id !== self?.id);

  let body: React.ReactNode;
  if (room.gameId === null) {
    body = <GamePicker selected={room.gameId} interactive={isVip} />;
  } else if (!isVip) {
    body = <p className="text-center text-lg text-muted-foreground">{t("waiting")}</p>;
  } else if (room.gameId === "quip") {
    body = <QuipSettingsPanel room={room} />;
  } else {
    body = <VipControls room={room} />;
  }

  return (
    <main
      className="flex min-h-dvh flex-col items-center gap-8 px-6 py-10"
      style={self ? { backgroundColor: `${self.color}14` } : undefined}
    >
      {self && (
        <div className="flex flex-col items-center gap-2">
          <span
            className="flex size-16 items-center justify-center rounded-full text-2xl font-bold text-white"
            style={{ backgroundColor: self.color }}
          >
            {self.name.charAt(0).toUpperCase()}
          </span>
          <p className="text-xl font-bold">{self.name}</p>
        </div>
      )}

      {body}

      {others.length > 0 && (
        <p className="mt-auto text-sm text-muted-foreground">
          {t("othersHere", { count: others.length })}
        </p>
      )}
    </main>
  );
}
