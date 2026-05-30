import { describe, expect, test } from "vitest";
import {
  generateRoomCode,
  isValidRoomCode,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  scoreAnswer,
  selectQuestions,
  toPublicRoomState,
  type Question,
  type RoomState,
} from "../index";

describe("room codes", () => {
  test("generated codes use the safe alphabet and pass validation", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect([...code].every((c) => ROOM_CODE_ALPHABET.includes(c))).toBe(true);
      expect(isValidRoomCode(code)).toBe(true);
    }
  });

  test("rejects confusable / malformed codes", () => {
    expect(isValidRoomCode("IO01")).toBe(false); // excluded letters/digits
    expect(isValidRoomCode("ABC")).toBe(false); // too short
    expect(isValidRoomCode("ABCDE")).toBe(false); // too long
  });
});

describe("selectQuestions", () => {
  const pool: Question[] = Array.from({ length: 30 }, (_, i) => ({
    id: `q${i}`,
    text: `Q${i}`,
    choices: ["a", "b", "c", "d"],
    correctIdx: 0,
    category: "General",
    country: "General",
    difficulty: "easy",
    locale: "en",
  }));

  test("returns the requested count with no repeats", () => {
    const picked = selectQuestions(pool, 10);
    expect(picked).toHaveLength(10);
    expect(new Set(picked.map((q) => q.id)).size).toBe(10);
  });

  test("clamps to the pool size", () => {
    expect(selectQuestions(pool.slice(0, 3), 10)).toHaveLength(3);
  });
});

describe("scoreAnswer", () => {
  test("matches PRD §16.2 at the boundaries", () => {
    const base = { timeLimitSec: 20, isFinalQuestion: false };
    expect(scoreAnswer({ ...base, isCorrect: false, msSinceQuestionStart: 0 })).toBe(0);
    expect(scoreAnswer({ ...base, isCorrect: true, msSinceQuestionStart: 0 })).toBe(1000);
    expect(scoreAnswer({ ...base, isCorrect: true, msSinceQuestionStart: 20_000 })).toBe(500);
    expect(
      scoreAnswer({ ...base, isFinalQuestion: true, isCorrect: true, msSinceQuestionStart: 0 }),
    ).toBe(2000);
  });
});

describe("toPublicRoomState redaction", () => {
  function room(phase: RoomState["phase"]): RoomState {
    const question: Question = {
      id: "q1",
      text: "Capital of France?",
      choices: ["Paris", "Lyon", "Nice", "Lille"],
      correctIdx: 0,
      category: "General",
      country: "General",
      difficulty: "easy",
      locale: "en",
    };
    return {
      code: "ABCD",
      hostSocketId: "sock",
      hostToken: "SECRET-TOKEN",
      hostDisconnectedAt: null,
      vipPlayerId: "p1",
      players: {
        p1: { id: "p1", name: "Al", color: "#EF4444", score: 0, connected: true, joinedAt: 1 },
      },
      sessions: { "sess-secret": "p1" },
      gameId: "trivia",
      quip: null,
      phase,
      prevPhase: null,
      phaseSeq: 1,
      locked: false,
      settings: { locale: "en", country: "General", category: "General", numQuestions: 1, timeLimitSec: 20 },
      questions: [question],
      currentIndex: 0,
      currentQuestionStartedAt: 1000,
      answers: { q1: { p1: { choice: 0, submittedAt: 1100, pointsEarned: 950 } } },
      createdAt: 0,
      lastActivityAt: 0,
    };
  }

  test("hides the correct answer and results during the question", () => {
    const pub = toPublicRoomState(room("question"));
    expect(pub.question?.correctIdx).toBeNull();
    expect(pub.results).toBeNull();
    expect(pub.questionStartedAt).toBe(1000);
  });

  test("exposes the correct answer and results from reveal onward", () => {
    const pub = toPublicRoomState(room("reveal"));
    expect(pub.question?.correctIdx).toBe(0);
    expect(pub.results).not.toBeNull();
    expect(pub.results?.[0]).toMatchObject({ playerId: "p1", correct: true, pointsEarned: 950 });
  });

  test("never leaks server-only secrets", () => {
    const pub = toPublicRoomState(room("reveal")) as unknown as Record<string, unknown>;
    expect(pub.hostToken).toBeUndefined();
    expect(pub.sessions).toBeUndefined();
    expect(JSON.stringify(pub)).not.toContain("SECRET-TOKEN");
    expect(JSON.stringify(pub)).not.toContain("sess-secret");
  });
});
