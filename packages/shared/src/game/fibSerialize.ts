import type { FibState, PublicFibOption, PublicFibState } from "./fib";
import type { RoomState } from "./types";

const REVEAL_PHASES = new Set(["reveal", "leaderboard", "final"]);

/**
 * Redacted fib view for one client. During spotting, authorship/sources/pick
 * counts are hidden (only `isOwnLie` is revealed, per-viewer, so a player can't
 * pick their own lie). At reveal everything opens up and `viewerResult` carries
 * the viewing player's own round result.
 */
export function toPublicFibState(room: RoomState, viewerId?: string): PublicFibState | null {
  const f: FibState | null = room.fib;
  if (!f) return null;
  const cur = f.current;
  const revealed = REVEAL_PHASES.has(f.phase);
  const showOptions = f.phase === "spotting" || revealed;

  const pickCounts: Record<string, number> = {};
  if (revealed) for (const optId of Object.values(cur.picks)) pickCounts[optId] = (pickCounts[optId] ?? 0) + 1;

  const nameOf = (id: string): string => room.players[id]?.name ?? "—";

  const options: PublicFibOption[] = showOptions
    ? cur.options.map((o) => ({
        id: o.id,
        text: o.text,
        isOwnLie: viewerId != null && o.authorIds.includes(viewerId),
        voided: Boolean(o.voided),
        ...(revealed
          ? { source: o.source, authorNames: o.authorIds.map(nameOf), pickCount: pickCounts[o.id] ?? 0 }
          : {}),
      }))
    : [];

  return {
    phase: f.phase,
    questionIndex: f.questionIndex,
    totalQuestions: f.totalQuestions,
    phaseEndsAt: f.phaseEndsAt,
    isFinalQuestion: f.questionIndex >= f.totalQuestions - 1,
    promptText: cur.promptText,
    truthText: revealed ? cur.truthText : null,
    options,
    writingDone: Object.keys(cur.lies),
    pickedPlayerIds: Object.keys(cur.picks),
    viewerResult: revealed && viewerId != null ? (cur.roundScores?.[viewerId] ?? null) : null,
  };
}
