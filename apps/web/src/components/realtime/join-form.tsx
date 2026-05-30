"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  isValidRoomCode,
  NAME_MAX_LENGTH,
  normalizeRoomCode,
  ROOM_CODE_LENGTH,
} from "@yalla/shared/game";
import type { ErrorCode } from "@yalla/shared";
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

export function JoinForm({ initialCode = "" }: { initialCode?: string }) {
  const t = useTranslations("join");
  const router = useRouter();
  const lastError = useGameStore((s) => s.lastError);
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    useGameStore.getState().setError(null);

    const normalized = normalizeRoomCode(code);
    if (!isValidRoomCode(normalized)) {
      setLocalError(t("errors.invalidCode"));
      return;
    }
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
      savePlayerSession(normalized, p.sessionId, p.playerId);
      router.push(`/play/${normalized}`);
    }
    function onError() {
      cleanup();
      setPending(false); // join was rejected; re-enable the form (error shown via store)
    }
    s.on("player:session", onSession);
    s.on("error", onError);
    emitWhenReady("player:join", { code: normalized, name: name.trim() });
  }

  const serverErrorKey = lastError ? ERROR_KEYS[lastError.code] : undefined;
  const errorText =
    localError ?? (serverErrorKey ? t(`errors.${serverErrorKey}`) : null);

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t("codeLabel")}</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={ROOM_CODE_LENGTH}
          autoCapitalize="characters"
          autoComplete="off"
          inputMode="text"
          placeholder={t("codePlaceholder")}
          className={`${inputClass} text-center font-mono text-2xl uppercase tracking-[0.5em]`}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t("nameLabel")}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="off"
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
  );
}
