// Per-room async mutex: serializes read-modify-write on a single room so two
// concurrent events (e.g. two players joining) can't clobber each other.
// In-process only — correct for a single node (v1). Horizontal scaling (v2)
// would replace this with a Redis-based lock.
const chains = new Map<string, Promise<unknown>>();

export function withRoomLock<T>(code: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(code) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  // Keep the chain alive even if `fn` rejects.
  chains.set(
    code,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}
