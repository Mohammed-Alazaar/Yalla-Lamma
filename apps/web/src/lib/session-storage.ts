"use client";

// Persist host/player credentials per room so a refreshed or dropped client can
// rejoin (PRD RECON-1). Wrapped in try/catch for SSR + privacy-mode safety.

const hostKey = (code: string) => `yl:host:${code}`;
const sessionKey = (code: string) => `yl:session:${code}`;

interface PlayerSession {
  sessionId: string;
  playerId: string;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function saveHostToken(code: string, hostToken: string): void {
  write(hostKey(code), { hostToken });
}

export function loadHostToken(code: string): string | null {
  return read<{ hostToken: string }>(hostKey(code))?.hostToken ?? null;
}

export function savePlayerSession(
  code: string,
  sessionId: string,
  playerId: string,
): void {
  write(sessionKey(code), { sessionId, playerId } satisfies PlayerSession);
}

export function loadPlayerSession(code: string): PlayerSession | null {
  return read<PlayerSession>(sessionKey(code));
}
