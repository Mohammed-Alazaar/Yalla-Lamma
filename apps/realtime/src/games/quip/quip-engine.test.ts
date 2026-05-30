import { describe, expect, test } from "vitest";
import {
  scoreQuipMatchup,
  type Player,
  type QuipPrompt,
  type QuipSettings,
  type RoomState,
} from "@yalla/shared";
import {
  advanceAfterLeaderboard,
  buildMatchups,
  eligibleVoterIds,
  fillSafetyAnswers,
  initQuip,
  recordQuipAnswer,
  recordVote,
  revealMatchup,
  startVoting,
  votingComplete,
  writingComplete,
} from "./engine";

const SETTINGS: QuipSettings = {
  totalRounds: 1,
  answerTimeSec: 90,
  voteTimeSec: 20,
  familyFriendly: true,
  audienceVoting: false,
};

function player(id: string): Player {
  return { id, name: id, color: "#EF4444", score: 0, connected: true, joinedAt: 0 };
}

function makeRoom(n: number): RoomState {
  const players: Record<string, Player> = {};
  for (let i = 0; i < n; i++) players[`p${i}`] = player(`p${i}`);
  return {
    code: "ABCD",
    hostSocketId: "h",
    hostToken: "t",
    hostDisconnectedAt: null,
    vipPlayerId: "p0",
    players,
    sessions: {},
    gameId: "quip",
    quip: null,
    quipSettings: SETTINGS,
    phase: "lobby",
    prevPhase: null,
    phaseSeq: 0,
    locked: false,
    settings: { locale: "en", country: "General", category: "General", numQuestions: 10, timeLimitSec: 20 },
    questions: [],
    currentIndex: 0,
    currentQuestionStartedAt: 0,
    answers: {},
    createdAt: 0,
    lastActivityAt: 0,
  };
}

const reserved = (n: number): QuipPrompt[] =>
  Array.from({ length: n }, (_, i) => ({ id: `q${i}`, text: `Prompt ${i}`, locale: "en", familyFriendly: true }));

// ─── scoreQuipMatchup (REV-2/REV-3) ──────────────────────────────────────────

describe("scoreQuipMatchup", () => {
  const base = { isSafety: [false, false] as [boolean, boolean], voided: false, isFinalRound: false };

  test("splits the pool proportionally by vote share", () => {
    expect(scoreQuipMatchup({ ...base, votes: [6, 4] })).toEqual([600, 400]);
  });

  test("clean sweep adds the Quiplash bonus", () => {
    expect(scoreQuipMatchup({ ...base, votes: [10, 0] })).toEqual([1250, 0]);
  });

  test("final round doubles the pool", () => {
    expect(scoreQuipMatchup({ ...base, votes: [6, 4], isFinalRound: true })).toEqual([1200, 800]);
  });

  test("voided matchup scores nothing", () => {
    expect(scoreQuipMatchup({ ...base, votes: [10, 0], voided: true })).toEqual([0, 0]);
  });

  test("no votes scores nothing", () => {
    expect(scoreQuipMatchup({ ...base, votes: [0, 0] })).toEqual([0, 0]);
  });

  test("a safety answer never earns points (opponent keeps its share)", () => {
    expect(scoreQuipMatchup({ ...base, votes: [5, 5], isSafety: [true, false] })).toEqual([0, 500]);
  });
});

// ─── engine flow ─────────────────────────────────────────────────────────────

describe("quip writing → voting → reveal", () => {
  function started(): RoomState {
    const room = makeRoom(3);
    initQuip(room, SETTINGS, reserved(3), 0); // 3 players, 3 prompts
    return room;
  }

  test("init assigns each player exactly 2 prompts and opens writing", () => {
    const room = started();
    expect(room.phase).toBe("playing");
    expect(room.quip!.phase).toBe("writing");
    for (const id of Object.keys(room.players)) {
      expect(room.quip!.assignments[id]).toHaveLength(2);
    }
  });

  test("records answers; writingComplete once everyone submits", () => {
    const room = started();
    const q = room.quip!;
    expect(writingComplete(room)).toBe(false);
    for (const [pid, prompts] of Object.entries(q.assignments)) {
      for (const promptId of prompts) {
        expect(recordQuipAnswer(room, pid, promptId, `${pid} on ${promptId}`, 0).accepted).toBe(true);
      }
    }
    expect(writingComplete(room)).toBe(true);
  });

  test("rejects unassigned and duplicate answers", () => {
    const room = started();
    const q = room.quip!;
    const pid = "p0";
    const mine = q.assignments[pid]!;
    expect(recordQuipAnswer(room, pid, mine[0]!, "x", 0).accepted).toBe(true);
    expect(recordQuipAnswer(room, pid, mine[0]!, "y", 0)).toEqual({ accepted: false, reason: "duplicate" });
    const notMine = Object.values(q.assignments).flat().find((p) => !mine.includes(p))!;
    expect(recordQuipAnswer(room, pid, notMine, "z", 0)).toEqual({ accepted: false, reason: "not_assigned" });
  });

  test("safety answers fill the gaps; matchups have exactly 2 answers each", () => {
    const room = started();
    fillSafetyAnswers(room);
    buildMatchups(room);
    const q = room.quip!;
    expect(q.matchups).toHaveLength(3);
    for (const m of q.matchups) {
      expect(m.answers).toHaveLength(2);
      expect(m.answers[0].isSafetyAnswer).toBe(true); // nobody submitted
      expect(m.answers[0].authorId).not.toBe(m.answers[1].authorId);
    }
  });

  test("authors are excluded from voting; reveal awards points", () => {
    const room = started();
    // everyone submits
    for (const [pid, prompts] of Object.entries(room.quip!.assignments)) {
      for (const promptId of prompts) recordQuipAnswer(room, pid, promptId, `${pid}:${promptId}`, 0);
    }
    startVoting(room, 0);
    const q = room.quip!;
    const m = q.matchups[0]!;
    const authors = [m.answers[0].authorId, m.answers[1].authorId];

    // An author can't vote on their own matchup.
    expect(recordVote(room, authors[0]!, 0, 1)).toEqual({ accepted: false, reason: "is_author" });

    const voters = eligibleVoterIds(room);
    expect(voters.every((v) => !authors.includes(v))).toBe(true);
    for (const v of voters) recordVote(room, v, 0, 0); // all vote for answer 0
    expect(votingComplete(room)).toBe(true);

    revealMatchup(room);
    expect(q.phase).toBe("reveal");
    // answer 0's author earned points (clean sweep), answer 1's did not.
    expect(room.players[m.answers[0].authorId]!.score).toBeGreaterThan(0);
    expect(m.pointsEarned).not.toBeUndefined();
  });

  test("advances to final after the last matchup of the last round", () => {
    const room = started();
    for (const [pid, prompts] of Object.entries(room.quip!.assignments)) {
      for (const promptId of prompts) recordQuipAnswer(room, pid, promptId, `${pid}:${promptId}`, 0);
    }
    startVoting(room, 0);
    const q = room.quip!;
    // Walk every matchup: reveal then advance.
    for (let i = 0; i < q.matchups.length; i++) {
      revealMatchup(room);
      const r = advanceAfterLeaderboard(room, 0);
      if (i < q.matchups.length - 1) {
        expect(r.finished).toBe(false);
        expect(q.phase).toBe("voting");
      } else {
        expect(r.finished).toBe(true);
        expect(room.phase).toBe("final");
      }
    }
  });
});
