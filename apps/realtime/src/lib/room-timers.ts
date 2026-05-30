// Shared per-room timer registry. A room runs one game at a time, so a single
// auto-advance timer per room is enough; both the trivia and quip flows use it.
// A separate grace-timer tracks the host-disconnect window (RECON-4).

const roomTimers = new Map<string, ReturnType<typeof setTimeout>>();
const graceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Schedule the room's single auto-advance timer, replacing any pending one. */
export function setRoomTimer(code: string, delayMs: number, fn: () => void): void {
  clearRoomTimer(code);
  const handle = setTimeout(fn, delayMs);
  handle.unref?.();
  roomTimers.set(code, handle);
}

export function clearRoomTimer(code: string): void {
  const handle = roomTimers.get(code);
  if (handle) {
    clearTimeout(handle);
    roomTimers.delete(code);
  }
}

/** Schedule the host-disconnect grace timer, replacing any pending one. */
export function setGraceTimer(code: string, delayMs: number, fn: () => void): void {
  clearGraceTimer(code);
  const handle = setTimeout(fn, delayMs);
  handle.unref?.();
  graceTimers.set(code, handle);
}

export function clearGraceTimer(code: string): void {
  const handle = graceTimers.get(code);
  if (handle) {
    clearTimeout(handle);
    graceTimers.delete(code);
  }
}

/** Cancel every pending timer (used by tests for clean teardown). */
export function clearAllRoomTimers(): void {
  for (const handle of roomTimers.values()) clearTimeout(handle);
  for (const handle of graceTimers.values()) clearTimeout(handle);
  roomTimers.clear();
  graceTimers.clear();
}
