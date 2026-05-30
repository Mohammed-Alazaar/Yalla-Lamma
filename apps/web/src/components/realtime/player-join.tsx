"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ErrorCode } from "@yalla/shared";
import { NAME_MAX_LENGTH } from "@yalla/shared";
import { Button } from "@/components/ui/button";
import { bindSocket, emitWhenReady } from "@/lib/socket";
import { savePlayerSession } from "@/lib/session-storage";
import { useGameStore } from "@/lib/game-store";

const ERROR_KEYS: Partial<Record<ErrorCode, string>> = {
  ROOM_NOT_FOUND: "roomNotFound",
  NAME_TAKEN: "nameTaken",
  NAME_REJECTED: "nameRejected",
  ROOM_FULL: "roomFull",
  ROOM_LOCKED: "roomLocked",
  WRONG_PHASE: "gameStarted",
};

const inputClass =
  "min-h-12 w-full rounded-md border border-input bg-background px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * Name entry shown on the room page (`/play/<CODE>`) for a fresh player — e.g.
 * someone who just scanned the QR. Joins in place; once joined, PlayerScreen
 * swaps to the lobby/game (no navigation needed).
 */
export function PlayerJoin({ code }: { code: string }) {
  const t = useTranslations("join");
  const lastError = useGameStore((s) => s.lastError);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    useGameStore.getState().setError(null);

    if (name.trim().length === 0) {
      setLocalError(t("errors.nameRequired"));
      return;
    }

    setPending(true);
    const s = bindSocket();
    const cleanup = () => {
      s.off("player:session", onSession);
      s.off("error", onError);
    };
    function onSession(p: { sessionId: string; playerId: string }) {
      cleanup();
      savePlayerSession(code, p.sessionId, p.playerId);
      // PlayerScreen re-renders into the lobby once the room state arrives.
    }
    function onError() {
      cleanup();
      setPending(false); // join rejected; re-enable (error shown via store)
    }
    s.on("player:session", onSession);
    s.on("error", onError);
    emitWhenReady("player:join", { code, name: name.trim() });
  }

  const serverErrorKey = lastError ? ERROR_KEYS[lastError.code] : undefined;
  const errorText = localError ?? (serverErrorKey ? t(`errors.${serverErrorKey}`) : null);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10">
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {t("codeLabel")}
        </p>
        <p className="font-mono text-5xl font-extrabold tracking-[0.3em]">{code}</p>
      </div>

      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("nameLabel")}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX_LENGTH}
            autoComplete="off"
            autoFocus
            placeholder={t("namePlaceholder")}
            className={inputClass}
          />
        </label>

        {errorText && (
          <p role="alert" className="text-sm text-destructive">
            {errorText}
          </p>
        )}

        <Button type="submit" size="lg" disabled={pending} className="min-h-12 text-base">
          {t("submit")}
        </Button>
      </form>
    </main>
  );
}
