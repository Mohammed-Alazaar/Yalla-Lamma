// Pure QuipParty engine: deterministic transitions over RoomState.quip. No I/O,
// no timers — `now` is passed in so it's unit-testable. The flow layer wraps
// these with the room lock, persistence, timers, and broadcasts.

import {
  QUIP_SAFETY_ANSWERS,
  scoreQuipMatchup,
  type QuipAnswer,
  type QuipMatchup,
  type QuipPrompt,
  type QuipSettings,
  type QuipState,
  type RoomState,
} from "@yalla/shared";
import { assignPrompts } from "./pairing";

export type QuipAnswerRejection = "wrong_phase" | "not_assigned" | "duplicate" | "too_late";
export type QuipVoteRejection = "wrong_phase" | "wrong_matchup" | "is_author" | "duplicate";

function quip(room: RoomState): QuipState {
  if (!room.quip) throw new Error("no quip state");
  return room.quip;
}

function rosterIds(room: RoomState): string[] {
  return Object.keys(room.players);
}

function connectedIds(room: RoomState): string[] {
  return Object.values(room.players)
    .filter((p) => p.connected)
    .map((p) => p.id);
}

function safetyText(seed: number): string {
  return QUIP_SAFETY_ANSWERS[seed % QUIP_SAFETY_ANSWERS.length]!;
}

/** Begin a round: assign prompts and open the writing phase. */
export function startRound(room: RoomState, round: number, now: number): void {
  const q = quip(room);
  const ids = rosterIds(room);
  const n = ids.length;
  const slice = q.reserved.slice((round - 1) * n, round * n);
  const { assignments, prompts } = assignPrompts(ids, slice, round);
  q.round = round;
  q.prompts = prompts;
  q.assignments = assignments;
  q.submitted = {};
  q.matchups = [];
  q.currentMatchup = 0;
  q.phase = "writing";
  q.phaseEndsAt = now + q.settings.answerTimeSec * 1000;
}

/** Initialize a fresh quip game and open round 1's writing phase. */
export function initQuip(
  room: RoomState,
  settings: QuipSettings,
  reserved: QuipPrompt[],
  now: number,
): void {
  room.gameId = "quip";
  room.phase = "playing";
  for (const p of Object.values(room.players)) p.score = 0;
  room.quip = {
    phase: "writing",
    round: 1,
    totalRounds: settings.totalRounds,
    settings,
    reserved,
    prompts: [],
    assignments: {},
    submitted: {},
    matchups: [],
    currentMatchup: 0,
    phaseEndsAt: 0,
    seq: 0,
  };
  startRound(room, 1, now);
}

export type QuipAnswerOutcome =
  | { accepted: true }
  | { accepted: false; reason: QuipAnswerRejection };

/** Record a player's answer to one assigned prompt (text already sanitized). */
export function recordQuipAnswer(
  room: RoomState,
  playerId: string,
  promptId: string,
  text: string,
  _now: number,
): QuipAnswerOutcome {
  const q = quip(room);
  if (q.phase !== "writing") return { accepted: false, reason: "wrong_phase" };
  if (!(q.assignments[playerId] ?? []).includes(promptId)) {
    return { accepted: false, reason: "not_assigned" };
  }
  const subs = (q.submitted[playerId] ??= []);
  if (subs.some((a) => a.promptId === promptId)) return { accepted: false, reason: "duplicate" };
  subs.push({ promptId, authorId: playerId, text, isSafetyAnswer: false });
  return { accepted: true };
}

/** Whether every connected player has submitted all their assigned answers. */
export function writingComplete(room: RoomState): boolean {
  const q = quip(room);
  const connected = connectedIds(room);
  if (connected.length === 0) return false;
  return connected.every(
    (id) => (q.submitted[id]?.length ?? 0) >= (q.assignments[id]?.length ?? 0),
  );
}

/** Auto-fill canned answers for any assignment that wasn't submitted (PA-5). */
export function fillSafetyAnswers(room: RoomState): void {
  const q = quip(room);
  let seed = 0;
  for (const [playerId, promptIds] of Object.entries(q.assignments)) {
    const subs = (q.submitted[playerId] ??= []);
    for (const promptId of promptIds) {
      if (!subs.some((a) => a.promptId === promptId)) {
        subs.push({ promptId, authorId: playerId, text: safetyText(seed++), isSafetyAnswer: true });
      }
    }
  }
}

/** Build one head-to-head matchup per prompt from the submitted answers. */
export function buildMatchups(room: RoomState): void {
  const q = quip(room);
  const byPrompt = new Map<string, QuipAnswer[]>();
  for (const subs of Object.values(q.submitted)) {
    for (const a of subs) {
      const list = byPrompt.get(a.promptId) ?? [];
      list.push(a);
      byPrompt.set(a.promptId, list);
    }
  }
  const matchups: QuipMatchup[] = [];
  for (const prompt of q.prompts) {
    const answers = byPrompt.get(prompt.id);
    if (!answers || answers.length !== 2) continue; // skip malformed (shouldn't happen)
    matchups.push({
      promptId: prompt.id,
      promptText: prompt.text,
      answers: [answers[0]!, answers[1]!],
      votes: {},
    });
  }
  q.matchups = matchups;
  q.currentMatchup = 0;
}

/** writing → voting: fill safety answers, build matchups, open voting. */
export function startVoting(room: RoomState, now: number): void {
  const q = quip(room);
  fillSafetyAnswers(room);
  buildMatchups(room);
  q.phase = "voting";
  q.currentMatchup = 0;
  q.phaseEndsAt = now + q.settings.voteTimeSec * 1000;
}

function currentMatchup(room: RoomState): QuipMatchup | undefined {
  const q = quip(room);
  return q.matchups[q.currentMatchup];
}

/** Connected players eligible to vote on the current matchup (not its authors). */
export function eligibleVoterIds(room: RoomState): string[] {
  const m = currentMatchup(room);
  if (!m) return [];
  const authors = new Set([m.answers[0].authorId, m.answers[1].authorId]);
  return connectedIds(room).filter((id) => !authors.has(id));
}

export type QuipVoteOutcome =
  | { accepted: true }
  | { accepted: false; reason: QuipVoteRejection };

/** Record a vote on the current matchup (VOTE-3/VOTE-6). */
export function recordVote(
  room: RoomState,
  voterId: string,
  matchupIndex: number,
  choice: 0 | 1,
): QuipVoteOutcome {
  const q = quip(room);
  if (q.phase !== "voting") return { accepted: false, reason: "wrong_phase" };
  if (matchupIndex !== q.currentMatchup) return { accepted: false, reason: "wrong_matchup" };
  const m = q.matchups[q.currentMatchup];
  if (!m) return { accepted: false, reason: "wrong_matchup" };
  if (m.answers[0].authorId === voterId || m.answers[1].authorId === voterId) {
    return { accepted: false, reason: "is_author" };
  }
  if (m.votes[voterId] !== undefined) return { accepted: false, reason: "duplicate" };
  m.votes[voterId] = choice;
  return { accepted: true };
}

/** Whether every eligible voter has voted on the current matchup. */
export function votingComplete(room: RoomState): boolean {
  const m = currentMatchup(room);
  if (!m) return false;
  const eligible = eligibleVoterIds(room);
  if (eligible.length === 0) return false;
  return eligible.every((id) => m.votes[id] !== undefined);
}

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

/** voting → reveal: score the current matchup and award points to its authors. */
export function revealMatchup(room: RoomState): void {
  const q = quip(room);
  const m = q.matchups[q.currentMatchup];
  if (m) {
    const points = scoreQuipMatchup({
      votes: voteCounts(m),
      isSafety: [m.answers[0].isSafetyAnswer, m.answers[1].isSafetyAnswer],
      voided: Boolean(m.voided),
      isFinalRound: q.round >= q.totalRounds,
    });
    m.pointsEarned = points;
    const a0 = room.players[m.answers[0].authorId];
    const a1 = room.players[m.answers[1].authorId];
    if (a0) a0.score += points[0];
    if (a1) a1.score += points[1];
  }
  q.phase = "reveal";
}

/** reveal → leaderboard. */
export function showQuipLeaderboard(room: RoomState): void {
  quip(room).phase = "leaderboard";
}

/**
 * leaderboard → next matchup voting | next round writing | final.
 * Returns whether the whole game finished.
 */
export function advanceAfterLeaderboard(room: RoomState, now: number): { finished: boolean } {
  const q = quip(room);
  if (q.currentMatchup < q.matchups.length - 1) {
    q.currentMatchup += 1;
    q.phase = "voting";
    q.phaseEndsAt = now + q.settings.voteTimeSec * 1000;
    return { finished: false };
  }
  if (q.round < q.totalRounds) {
    startRound(room, q.round + 1, now);
    return { finished: false };
  }
  room.phase = "final";
  return { finished: true };
}
