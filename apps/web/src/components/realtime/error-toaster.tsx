"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { SocketError } from "@yalla/shared";
import { useGameStore } from "@/lib/game-store";

/**
 * Surfaces server `error` events as toasts during gameplay (the join page shows
 * its own inline errors, so this is only mounted on the host/player screens).
 * Dedupes by object identity — each server error is a fresh object.
 */
export function ErrorToaster() {
  const lastError = useGameStore((s) => s.lastError);
  const t = useTranslations("errors");
  const seen = useRef<SocketError | null>(null);

  useEffect(() => {
    if (!lastError || lastError === seen.current) return;
    seen.current = lastError;
    const message = t.has(lastError.code) ? t(lastError.code) : lastError.message;
    toast.error(message);
  }, [lastError, t]);

  return null;
}
