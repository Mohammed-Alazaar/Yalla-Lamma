"use client";

import { useEffect, useState } from "react";

export interface Countdown {
  remainingMs: number;
  remainingSec: number; // rounded up, for display
  fraction: number; // 1 → 0 over the time limit
  expired: boolean;
}

/**
 * Client-side countdown derived from the server's authoritative
 * `questionStartedAt` + `timeLimitSec` (ADR 0001 — no per-tick broadcast). The
 * server remains the source of truth for scoring; this only drives the UI.
 *
 * The countdown is computed during render from a ticking `now`, so a new
 * question (changed `startedAt`) is reflected immediately without a
 * setState-in-effect cascade.
 */
export function useCountdown(startedAt: number | null, timeLimitSec: number): Countdown {
  const totalMs = timeLimitSec * 1000;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [startedAt]);

  if (startedAt == null) {
    return { remainingMs: totalMs, remainingSec: timeLimitSec, fraction: 1, expired: false };
  }
  const remainingMs = Math.max(0, totalMs - (now - startedAt));
  return {
    remainingMs,
    remainingSec: Math.ceil(remainingMs / 1000),
    fraction: totalMs > 0 ? remainingMs / totalMs : 0,
    expired: remainingMs <= 0,
  };
}
