import { describe, expect, test } from "vitest";
import { scoreAnswer, type Player, type Question, type RoomState } from "@yalla/shared";
import {
  advanceQuestion,
  allConnectedAnswered,
  currentQuestion,
  isFinalQuestion,
  recordAnswer,
  resetForReplay,
  revealAnswer,
  showLeaderboard,
  standings,
  startGame,
} from "../game/engine";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeQuestion(id: string, correctIdx = 0): Question {
  return {
    id,
    text: `Q ${id}`,
    choices: ["A", "B", "C", "D"],
    correctIdx,
    category: "General",
    country: "General",
    difficulty: "easy",
    locale: "en",
  };
}

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    color: "#EF4444",
    score: 0,
    connected: true,
    joinedAt: 0,
    ...overrides,
  };
}

function makeRoom(overrides: Partial<RoomState> = {}): RoomState {
  return {
    code: "ABCD",
    hostSocketId: "host",
    hostToken: "tok",
    hostDisconnectedAt: null,
    vipPlayerId: "p1",
    players: { p1: makePlayer("p1"), p2: makePlayer("p2") },
    sessions: {},
    gameId: "trivia",
    quip: null,
    quipSettings: { totalRounds: 3, answerTimeSec: 90, voteTimeSec: 20, familyFriendly: true, audienceVoting: true },
    fib: null,
    fibSettings: { totalQuestions: 8, category: "General", lieTimeSec: 45, spotTimeSec: 30, familyFriendly: true },
    phase: "lobby",
    prevPhase: null,
    phaseSeq: 0,
    locked: false,
    settings: { locale: "en", country: "General", category: "General", numQuestions: 2, timeLimitSec: 20 },
    questions: [],
    currentIndex: 0,
    currentQuestionStartedAt: 0,
    answers: {},
    createdAt: 0,
    lastActivityAt: 0,
    ...overrides,
  };
}

// ─── scoreAnswer (PRD §16.2) ─────────────────────────────────────────────────

describe("scoreAnswer", () => {
  const base = { timeLimitSec: 20, isFinalQuestion: false };

  test("wrong answer scores 0", () => {
    expect(scoreAnswer({ ...base, isCorrect: false, msSinceQuestionStart: 0 })).toBe(0);
  });

  test("instant correct answer scores base + full speed bonus", () => {
    expect(scoreAnswer({ ...base, isCorrect: true, msSinceQuestionStart: 0 })).toBe(1000);
  });

  test("answer at the buzzer scores base only (bonus decays to 0)", () => {
    expect(scoreAnswer({ ...base, isCorrect: true, msSinceQuestionStart: 20_000 })).toBe(500);
  });

  test("halfway answer scores base + half bonus", () => {
    expect(scoreAnswer({ ...base, isCorrect: true, msSinceQuestionStart: 10_000 })).toBe(750);
  });

  test("never goes negative past the timer", () => {
    expect(scoreAnswer({ ...base, isCorrect: true, msSinceQuestionStart: 99_000 })).toBe(500);
  });

  test("final question doubles the total", () => {
    expect(
      scoreAnswer({ ...base, isFinalQuestion: true, isCorrect: true, msSinceQuestionStart: 0 }),
    ).toBe(2000);
    expect(
      scoreAnswer({ ...base, isFinalQuestion: true, isCorrect: true, msSinceQuestionStart: 10_000 }),
    ).toBe(1500);
  });
});

// ─── startGame ───────────────────────────────────────────────────────────────

describe("startGame", () => {
  test("assigns questions, resets scores, opens the first question", () => {
    const room = makeRoom();
    room.players.p1!.score = 999;
    startGame(room, [makeQuestion("q1"), makeQuestion("q2")], 1_000);

    expect(room.phase).toBe("question");
    expect(room.currentIndex).toBe(0);
    expect(room.currentQuestionStartedAt).toBe(1_000);
    expect(room.players.p1!.score).toBe(0);
    expect(currentQuestion(room)?.id).toBe("q1");
    expect(isFinalQuestion(room)).toBe(false);
  });
});

// ─── recordAnswer ────────────────────────────────────────────────────────────

describe("recordAnswer", () => {
  function started(): RoomState {
    const room = makeRoom();
    startGame(room, [makeQuestion("q1", 0), makeQuestion("q2", 2)], 0);
    return room;
  }

  test("scores a correct answer and adds to the player's total", () => {
    const room = started();
    const out = recordAnswer(room, "p1", "q1", 0, 0);
    expect(out).toEqual({ accepted: true, isCorrect: true, pointsEarned: 1000 });
    expect(room.players.p1!.score).toBe(1000);
    expect(room.answers.q1!.p1).toMatchObject({ choice: 0, pointsEarned: 1000 });
  });

  test("a wrong answer is accepted but scores 0", () => {
    const room = started();
    const out = recordAnswer(room, "p1", "q1", 3, 0);
    expect(out).toEqual({ accepted: true, isCorrect: false, pointsEarned: 0 });
    expect(room.players.p1!.score).toBe(0);
  });

  test("double submission is rejected", () => {
    const room = started();
    recordAnswer(room, "p1", "q1", 0, 0);
    const second = recordAnswer(room, "p1", "q1", 1, 100);
    expect(second).toEqual({ accepted: false, reason: "duplicate" });
    expect(room.players.p1!.score).toBe(1000); // unchanged
  });

  test("answers outside the question phase are rejected", () => {
    const room = started();
    room.phase = "reveal";
    expect(recordAnswer(room, "p1", "q1", 0, 0)).toEqual({
      accepted: false,
      reason: "wrong_phase",
    });
  });

  test("answers for a stale question id are rejected", () => {
    const room = started();
    expect(recordAnswer(room, "p1", "q2", 0, 0)).toEqual({
      accepted: false,
      reason: "wrong_question",
    });
  });

  test("answers well past the timer are rejected (no points)", () => {
    const room = started(); // timeLimit 20s, grace 750ms
    const out = recordAnswer(room, "p1", "q1", 0, 22_000);
    expect(out).toEqual({ accepted: false, reason: "too_late" });
    expect(room.players.p1!.score).toBe(0);
  });

  test("a buzzer-beater within the grace window scores base points only", () => {
    const room = started(); // timeLimit 20s, grace 750ms
    const out = recordAnswer(room, "p1", "q1", 0, 20_500); // just past the buzzer
    expect(out).toEqual({ accepted: true, isCorrect: true, pointsEarned: 500 });
    expect(room.players.p1!.score).toBe(500);
  });

  test("unknown players are rejected", () => {
    const room = started();
    expect(recordAnswer(room, "ghost", "q1", 0, 0)).toEqual({
      accepted: false,
      reason: "no_player",
    });
  });

  test("the final question is worth double", () => {
    const room = started();
    room.currentIndex = 1; // q2 is final
    const out = recordAnswer(room, "p1", "q2", 2, 0);
    expect(out).toEqual({ accepted: true, isCorrect: true, pointsEarned: 2000 });
  });
});

// ─── allConnectedAnswered ────────────────────────────────────────────────────

describe("allConnectedAnswered", () => {
  test("true once every connected player has answered", () => {
    const room = makeRoom();
    startGame(room, [makeQuestion("q1")], 0);
    expect(allConnectedAnswered(room)).toBe(false);
    recordAnswer(room, "p1", "q1", 0, 0);
    expect(allConnectedAnswered(room)).toBe(false);
    recordAnswer(room, "p2", "q1", 1, 0);
    expect(allConnectedAnswered(room)).toBe(true);
  });

  test("ignores disconnected players (they miss with 0)", () => {
    const room = makeRoom();
    room.players.p2!.connected = false;
    startGame(room, [makeQuestion("q1")], 0);
    recordAnswer(room, "p1", "q1", 0, 0);
    expect(allConnectedAnswered(room)).toBe(true);
  });

  test("false when nobody is connected", () => {
    const room = makeRoom();
    room.players.p1!.connected = false;
    room.players.p2!.connected = false;
    startGame(room, [makeQuestion("q1")], 0);
    expect(allConnectedAnswered(room)).toBe(false);
  });
});

// ─── phase transitions ───────────────────────────────────────────────────────

describe("phase transitions", () => {
  test("question → reveal → leaderboard → next question", () => {
    const room = makeRoom();
    startGame(room, [makeQuestion("q1"), makeQuestion("q2")], 0);

    revealAnswer(room);
    expect(room.phase).toBe("reveal");

    showLeaderboard(room);
    expect(room.phase).toBe("leaderboard");

    const r1 = advanceQuestion(room, 5_000);
    expect(r1).toEqual({ finished: false });
    expect(room.phase).toBe("question");
    expect(room.currentIndex).toBe(1);
    expect(room.currentQuestionStartedAt).toBe(5_000);
  });

  test("advancing past the last question ends the game", () => {
    const room = makeRoom();
    startGame(room, [makeQuestion("q1")], 0);
    showLeaderboard(room);
    const r = advanceQuestion(room, 1_000);
    expect(r).toEqual({ finished: true });
    expect(room.phase).toBe("final");
  });

  test("resetForReplay returns to the lobby with cleared scores", () => {
    const room = makeRoom();
    startGame(room, [makeQuestion("q1")], 0);
    recordAnswer(room, "p1", "q1", 0, 0);
    room.phase = "final";

    resetForReplay(room);
    expect(room.phase).toBe("lobby");
    expect(room.questions).toEqual([]);
    expect(room.currentIndex).toBe(0);
    expect(room.answers).toEqual({});
    expect(room.players.p1!.score).toBe(0);
  });
});

// ─── standings ───────────────────────────────────────────────────────────────

describe("standings", () => {
  test("ranks by score descending with shared ranks for ties", () => {
    const room = makeRoom({
      players: {
        a: makePlayer("a", { name: "Ann", score: 1500 }),
        b: makePlayer("b", { name: "Bob", score: 1500 }),
        c: makePlayer("c", { name: "Cy", score: 800 }),
      },
    });
    const ranked = standings(room);
    expect(ranked.map((s) => [s.name, s.rank])).toEqual([
      ["Ann", 1],
      ["Bob", 1],
      ["Cy", 3],
    ]);
  });
});
