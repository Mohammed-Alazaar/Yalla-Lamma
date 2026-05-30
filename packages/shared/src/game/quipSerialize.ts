import type { PublicQuipMatchup, PublicQuipState, QuipMatchup, QuipState } from "./quip";
import type { RoomState } from "./types";

const REVEAL_PHASES = new Set(["reveal", "leaderboard", "final"]);

function voteCounts(m: QuipMatchup): [number, number] {
  let a = 0;
  let b = 0;
  for (const v of Object.values(m.votes)) (v === 0 ? a++ : b++);
  if (m.audienceVotes) {
    a += m.audienceVotes[0];
    b += m.audienceVotes[1];
  }
  return [a, b];
}

/**
 * Redacted quip view for clients. Author ids are exposed only so a phone can
 * tell if it authored the current matchup (and must abstain); vote counts and
 * points stay hidden until the reveal phase.
 */
export function toPublicQuipState(room: RoomState): PublicQuipState | null {
  const q: QuipState | null = room.quip;
  if (!q) return null;

  const writingDone = Object.keys(q.assignments).filter(
    (pid) => (q.submitted[pid]?.length ?? 0) >= (q.assignments[pid]?.length ?? 0),
  );

  let matchup: PublicQuipMatchup | null = null;
  const m = q.matchups[q.currentMatchup];
  if ((q.phase === "voting" || q.phase === "reveal") && m) {
    const revealed = REVEAL_PHASES.has(q.phase);
    matchup = {
      promptText: m.promptText,
      answers: [m.answers[0].text, m.answers[1].text],
      authorIds: [m.answers[0].authorId, m.answers[1].authorId],
      isSafety: [m.answers[0].isSafetyAnswer, m.answers[1].isSafetyAnswer],
      voteCounts: revealed ? voteCounts(m) : null,
      pointsEarned: revealed && m.pointsEarned ? m.pointsEarned : null,
      voided: Boolean(m.voided),
    };
  }

  const votedPlayerIds = m ? Object.keys(m.votes) : [];
  const promptTexts: Record<string, string> = {};
  for (const p of q.prompts) promptTexts[p.id] = p.text;

  return {
    phase: q.phase,
    round: q.round,
    totalRounds: q.totalRounds,
    phaseEndsAt: q.phaseEndsAt,
    isFinalRound: q.round >= q.totalRounds,
    assignments: q.assignments,
    promptTexts,
    writingDone,
    matchup,
    matchupIndex: q.currentMatchup,
    matchupTotal: q.matchups.length,
    votedPlayerIds,
  };
}
