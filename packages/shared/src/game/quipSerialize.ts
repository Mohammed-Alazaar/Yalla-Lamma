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
 * Redacted quip view for one client. `viewerSide` tells only the viewing player
 * whether (and which side) they authored the current matchup — authorship is
 * never revealed to other voters (blind voting). Vote counts/points stay hidden
 * until reveal, and assignments/prompt texts are exposed only during writing.
 */
export function toPublicQuipState(room: RoomState, viewerId?: string): PublicQuipState | null {
  const q: QuipState | null = room.quip;
  if (!q) return null;

  const writingDone = Object.keys(q.assignments).filter(
    (pid) => (q.submitted[pid]?.length ?? 0) >= (q.assignments[pid]?.length ?? 0),
  );

  let matchup: PublicQuipMatchup | null = null;
  const m = q.matchups[q.currentMatchup];
  if ((q.phase === "voting" || q.phase === "reveal") && m) {
    const revealed = REVEAL_PHASES.has(q.phase);
    const viewerSide: 0 | 1 | null =
      viewerId === m.answers[0].authorId ? 0 : viewerId === m.answers[1].authorId ? 1 : null;
    matchup = {
      promptText: m.promptText,
      answers: [m.answers[0].text, m.answers[1].text],
      viewerSide,
      isSafety: [m.answers[0].isSafetyAnswer, m.answers[1].isSafetyAnswer],
      voteCounts: revealed ? voteCounts(m) : null,
      pointsEarned: revealed && m.pointsEarned ? m.pointsEarned : null,
      voided: Boolean(m.voided),
    };
  }

  const votedPlayerIds = m ? Object.keys(m.votes) : [];
  // Only expose assignments + prompt texts during writing; otherwise a voter
  // could map promptText → promptId → the two assigned authors (blind voting).
  const writing = q.phase === "writing";
  const promptTexts: Record<string, string> = {};
  if (writing) for (const p of q.prompts) promptTexts[p.id] = p.text;

  return {
    phase: q.phase,
    round: q.round,
    totalRounds: q.totalRounds,
    phaseEndsAt: q.phaseEndsAt,
    isFinalRound: q.round >= q.totalRounds,
    assignments: writing ? q.assignments : {},
    promptTexts,
    writingDone,
    matchup,
    matchupIndex: q.currentMatchup,
    matchupTotal: q.matchups.length,
    votedPlayerIds,
  };
}
