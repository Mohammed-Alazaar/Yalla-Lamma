// Pure FibParty engine: deterministic transitions over RoomState.fib. `now` is
// passed in for testability. The flow layer adds the lock, timers, persistence,
// and broadcasts.

import {
  FIB_FINAL_MULTIPLIER,
  FIB_TRUTH_POINTS,
  foolingPoints,
  type Fact,
  type FibQuestionState,
  type FibState,
  type FibViewerResult,
  type FibSettings,
  type RoomState,
} from "@yalla/shared";
import { assembleOptions, normalizeAnswer } from "./options";

export type FibLieRejection = "wrong_phase" | "wrong_fact" | "duplicate" | "too_close_to_truth";
export type FibPickRejection = "wrong_phase" | "no_option" | "own_lie" | "duplicate";

function fib(room: RoomState): FibState {
  if (!room.fib) throw new Error("no fib state");
  return room.fib;
}

function connectedIds(room: RoomState): string[] {
  return Object.values(room.players).filter((p) => p.connected).map((p) => p.id);
}

function makeQuestion(fact: Fact): FibQuestionState {
  return {
    factId: fact.id,
    promptText: fact.text,
    truthText: fact.truth,
    lies: {},
    autoFilledIds: [],
    options: [],
    picks: {},
    pickStartedAt: 0,
  };
}

/** Initialize a fresh fib game and open question 1's writing phase. */
export function initFib(room: RoomState, settings: FibSettings, facts: Fact[], now: number): void {
  room.gameId = "fib";
  room.phase = "playing";
  for (const p of Object.values(room.players)) p.score = 0;
  room.fib = {
    phase: "writing",
    questionIndex: 0,
    totalQuestions: Math.min(settings.totalQuestions, facts.length),
    settings,
    facts,
    current: makeQuestion(facts[0]!),
    phaseEndsAt: now + settings.lieTimeSec * 1000,
    seq: 0,
  };
}

function currentFact(room: RoomState): Fact {
  const f = fib(room);
  return f.facts[f.questionIndex]!;
}

export type FibLieOutcome = { accepted: true } | { accepted: false; reason: FibLieRejection };

/** Whether a candidate lie collides with the current truth (FLIE-5). */
export function collidesWithTruth(room: RoomState, text: string): boolean {
  return normalizeAnswer(text) === normalizeAnswer(fib(room).current.truthText);
}

/** Record a player's lie (text already sanitized; truth-collision pre-checked). */
export function recordLie(
  room: RoomState,
  playerId: string,
  factId: string,
  text: string,
): FibLieOutcome {
  const f = fib(room);
  if (f.phase !== "writing") return { accepted: false, reason: "wrong_phase" };
  if (factId !== f.current.factId) return { accepted: false, reason: "wrong_fact" };
  if (f.current.lies[playerId] !== undefined) return { accepted: false, reason: "duplicate" };
  if (collidesWithTruth(room, text)) return { accepted: false, reason: "too_close_to_truth" };
  f.current.lies[playerId] = text;
  return { accepted: true };
}

/** Whether every connected player has submitted a lie. */
export function writingComplete(room: RoomState): boolean {
  const connected = connectedIds(room);
  if (connected.length === 0) return false;
  return connected.every((id) => room.fib!.current.lies[id] !== undefined);
}

/**
 * Give a random unused decoy to any connected player who didn't submit a lie
 * (FLIE-6). Recorded in autoFilledIds so the option is treated as a decoy (no
 * fooling credit) — a no-show shouldn't earn points for text they never wrote.
 */
export function fillDecoyLies(room: RoomState): void {
  const f = fib(room);
  const fact = currentFact(room);
  const used = new Set<string>([normalizeAnswer(fact.truth)]);
  for (const lie of Object.values(f.current.lies)) used.add(normalizeAnswer(lie));
  const available = fact.decoys.filter((d) => !used.has(normalizeAnswer(d)));
  let di = 0;
  for (const player of Object.values(room.players)) {
    if (!player.connected) continue; // a gone player adds nothing to the list
    if (f.current.lies[player.id] !== undefined) continue;
    const decoy = available[di++];
    if (decoy) {
      f.current.lies[player.id] = decoy;
      f.current.autoFilledIds.push(player.id);
    }
  }
}

/** writing → spotting: fill missing lies, assemble + shuffle options, open voting. */
export function startSpotting(room: RoomState, now: number): void {
  const f = fib(room);
  fillDecoyLies(room);
  const fact = currentFact(room);
  f.current.options = assembleOptions(
    fact.truth,
    fact.decoys,
    f.current.lies,
    new Set(f.current.autoFilledIds),
  );
  f.current.picks = {};
  f.current.pickStartedAt = now;
  f.phase = "spotting";
  f.phaseEndsAt = now + f.settings.spotTimeSec * 1000;
}

export type FibPickOutcome = { accepted: true } | { accepted: false; reason: FibPickRejection };

/** Record a player's truth-spotting pick (FSPOT-3/4). */
export function recordPick(room: RoomState, playerId: string, optionId: string): FibPickOutcome {
  const f = fib(room);
  if (f.phase !== "spotting") return { accepted: false, reason: "wrong_phase" };
  const opt = f.current.options.find((o) => o.id === optionId);
  if (!opt || opt.voided) return { accepted: false, reason: "no_option" };
  if (opt.authorIds.includes(playerId)) return { accepted: false, reason: "own_lie" };
  if (f.current.picks[playerId] !== undefined) return { accepted: false, reason: "duplicate" };
  f.current.picks[playerId] = optionId;
  return { accepted: true };
}

/** Whether every connected player has picked. */
export function spottingComplete(room: RoomState): boolean {
  const connected = connectedIds(room);
  if (connected.length === 0) return false;
  return connected.every((id) => room.fib!.current.picks[id] !== undefined);
}

/** spotting → reveal: dual scoring (find-truth + fooling), credit merged authors. */
export function revealQuestion(room: RoomState): void {
  const f = fib(room);
  const cur = f.current;
  const isFinal = f.questionIndex >= f.totalQuestions - 1;
  const mult = isFinal ? FIB_FINAL_MULTIPLIER : 1;

  const truthOpt = cur.options.find((o) => o.source === "truth");
  const pickCount: Record<string, number> = {};
  for (const optId of Object.values(cur.picks)) pickCount[optId] = (pickCount[optId] ?? 0) + 1;

  const round: Record<string, FibViewerResult> = {};
  const ensure = (pid: string): FibViewerResult =>
    (round[pid] ??= { foundTruth: false, truthPoints: 0, fooled: 0, foolPoints: 0 });

  // Find-the-truth points.
  if (truthOpt) {
    for (const [pid, optId] of Object.entries(cur.picks)) {
      if (optId === truthOpt.id) {
        const r = ensure(pid);
        r.foundTruth = true;
        r.truthPoints = FIB_TRUTH_POINTS * mult;
      }
    }
  }

  // Fooling points: each author of a picked player-lie earns per pick.
  for (const opt of cur.options) {
    if (opt.source !== "player" || opt.voided) continue;
    const picks = pickCount[opt.id] ?? 0;
    if (picks === 0) continue;
    for (const author of opt.authorIds) {
      const r = ensure(author);
      r.fooled += picks;
      r.foolPoints += foolingPoints(picks, isFinal);
    }
  }

  for (const [pid, r] of Object.entries(round)) {
    const player = room.players[pid];
    if (player) player.score += r.truthPoints + r.foolPoints;
  }
  cur.roundScores = round;
  f.phase = "reveal";
}

/** reveal → leaderboard. */
export function showFibLeaderboard(room: RoomState): void {
  fib(room).phase = "leaderboard";
}

/** leaderboard → next question writing | final. Returns whether the game ended. */
export function advanceAfterLeaderboard(room: RoomState, now: number): { finished: boolean } {
  const f = fib(room);
  if (f.questionIndex < f.totalQuestions - 1) {
    f.questionIndex += 1;
    f.current = makeQuestion(f.facts[f.questionIndex]!);
    f.phase = "writing";
    f.phaseEndsAt = now + f.settings.lieTimeSec * 1000;
    return { finished: false };
  }
  room.phase = "final";
  return { finished: true };
}
