import { describe, expect, test } from "vitest";
import {
  FIB_FOOL_POINTS,
  FIB_TRUTH_POINTS,
  type Fact,
  type FibSettings,
  type RoomState,
} from "@yalla/shared";
import {
  advanceAfterLeaderboard,
  fillDecoyLies,
  recordLie,
  recordPick,
  revealQuestion,
  spottingComplete,
  startSpotting,
  writingComplete,
} from "./engine";

const SETTINGS: FibSettings = {
  totalQuestions: 2,
  category: "General",
  lieTimeSec: 45,
  spotTimeSec: 30,
  familyFriendly: true,
};

const FACTS: Fact[] = [
  {
    id: "f1",
    locale: "en",
    text: "The largest planet is ___.",
    truth: "Jupiter",
    decoys: ["Saturn", "Neptune", "Uranus"],
    category: "General",
    difficulty: "easy",
    familyFriendly: true,
  },
  {
    id: "f2",
    locale: "en",
    text: "The first US president was ___.",
    truth: "Washington",
    decoys: ["Adams", "Jefferson"],
    category: "General",
    difficulty: "easy",
    familyFriendly: true,
  },
];

function makeRoom(playerIds: string[], settings = SETTINGS): RoomState {
  const players: RoomState["players"] = {};
  for (const id of playerIds) {
    players[id] = {
      id,
      name: id,
      color: "#fff",
      score: 0,
      connected: true,
      isVip: id === playerIds[0],
      joinedAt: 0,
    } as RoomState["players"][string];
  }
  return {
    code: "ABCD",
    gameId: "fib",
    phase: "playing",
    players,
    hostConnected: true,
    createdAt: 0,
    lastActivityAt: 0,
    fib: {
      phase: "writing",
      questionIndex: 0,
      totalQuestions: settings.totalQuestions,
      settings,
      facts: FACTS,
      current: {
        factId: "f1",
        promptText: FACTS[0]!.text,
        truthText: FACTS[0]!.truth,
        lies: {},
        options: [],
        picks: {},
        pickStartedAt: 0,
      },
      phaseEndsAt: 0,
      seq: 0,
    },
  } as unknown as RoomState;
}

function optByText(room: RoomState, text: string): string {
  return room.fib!.current.options.find((o) => o.text === text)!.id;
}

describe("fib engine — writing", () => {
  test("recordLie locks one submission and rejects a duplicate", () => {
    const room = makeRoom(["a", "b"]);
    expect(recordLie(room, "a", "f1", "Mars").accepted).toBe(true);
    const dup = recordLie(room, "a", "f1", "Venus");
    expect(dup).toEqual({ accepted: false, reason: "duplicate" });
    expect(room.fib!.current.lies.a).toBe("Mars");
  });

  test("recordLie rejects a lie that collides with the truth (FLIE-5)", () => {
    const room = makeRoom(["a", "b"]);
    expect(recordLie(room, "a", "f1", " jupiter ")).toEqual({
      accepted: false,
      reason: "too_close_to_truth",
    });
  });

  test("writingComplete only when every connected player submitted", () => {
    const room = makeRoom(["a", "b"]);
    recordLie(room, "a", "f1", "Mars");
    expect(writingComplete(room)).toBe(false);
    recordLie(room, "b", "f1", "Venus");
    expect(writingComplete(room)).toBe(true);
  });

  test("fillDecoyLies gives non-submitters an unused decoy", () => {
    const room = makeRoom(["a", "b"]);
    recordLie(room, "a", "f1", "Mars");
    fillDecoyLies(room);
    expect(room.fib!.current.lies.b).toBeDefined();
    expect(FACTS[0]!.decoys).toContain(room.fib!.current.lies.b);
  });
});

describe("fib engine — scoring", () => {
  test("finding the truth earns truth points; being fooled earns the author fool points", () => {
    const room = makeRoom(["a", "b", "c"]);
    recordLie(room, "a", "f1", "Mars");
    recordLie(room, "b", "f1", "Venus");
    recordLie(room, "c", "f1", "Pluto");
    startSpotting(room, 0);

    // a finds the truth; b & c both pick a's lie "Mars".
    expect(recordPick(room, "a", optByText(room, "Jupiter")).accepted).toBe(true);
    expect(recordPick(room, "b", optByText(room, "Mars")).accepted).toBe(true);
    expect(recordPick(room, "c", optByText(room, "Mars")).accepted).toBe(true);
    expect(spottingComplete(room)).toBe(true);

    revealQuestion(room);
    // a: found truth (+1000) and fooled 2 (+2*500) = 2000.
    expect(room.players.a!.score).toBe(FIB_TRUTH_POINTS + 2 * FIB_FOOL_POINTS);
    expect(room.fib!.current.roundScores!.a).toEqual({
      foundTruth: true,
      truthPoints: FIB_TRUTH_POINTS,
      fooled: 2,
      foolPoints: 2 * FIB_FOOL_POINTS,
    });
    // b & c found nothing and fooled no one.
    expect(room.players.b!.score).toBe(0);
    expect(room.players.c!.score).toBe(0);
  });

  test("picking your own lie is rejected (FSPOT-4)", () => {
    const room = makeRoom(["a", "b"]);
    recordLie(room, "a", "f1", "Mars");
    recordLie(room, "b", "f1", "Venus");
    startSpotting(room, 0);
    expect(recordPick(room, "a", optByText(room, "Mars"))).toEqual({
      accepted: false,
      reason: "own_lie",
    });
  });

  test("a duplicate lie credits all merged authors", () => {
    const room = makeRoom(["a", "b", "c", "d"]);
    recordLie(room, "a", "f1", "Mars");
    recordLie(room, "b", "f1", "mars"); // same normalized as a
    recordLie(room, "c", "f1", "Venus");
    recordLie(room, "d", "f1", "Pluto");
    startSpotting(room, 0);
    // c picks the merged "Mars" option.
    recordPick(room, "c", optByText(room, "Mars"));
    recordPick(room, "d", optByText(room, "Jupiter"));
    recordPick(room, "a", optByText(room, "Venus"));
    recordPick(room, "b", optByText(room, "Venus"));
    revealQuestion(room);
    // Both a and b are credited for c's single pick on their shared lie.
    expect(room.players.a!.score).toBe(FIB_FOOL_POINTS);
    expect(room.players.b!.score).toBe(FIB_FOOL_POINTS);
  });

  test("the final question doubles both truth and fool points", () => {
    const room = makeRoom(["a", "b"], { ...SETTINGS, totalQuestions: 1 });
    room.fib!.totalQuestions = 1; // index 0 is the final question
    recordLie(room, "a", "f1", "Mars");
    recordLie(room, "b", "f1", "Venus");
    startSpotting(room, 0);
    recordPick(room, "a", optByText(room, "Jupiter")); // a finds truth
    recordPick(room, "b", optByText(room, "Mars")); // b fooled by a
    revealQuestion(room);
    expect(room.players.a!.score).toBe(FIB_TRUTH_POINTS * 2 + FIB_FOOL_POINTS * 2);
  });
});

describe("fib engine — advance", () => {
  test("advances to the next question, then ends on the last", () => {
    const room = makeRoom(["a", "b"]);
    expect(advanceAfterLeaderboard(room, 0)).toEqual({ finished: false });
    expect(room.fib!.questionIndex).toBe(1);
    expect(room.fib!.current.factId).toBe("f2");
    expect(room.fib!.phase).toBe("writing");
    expect(advanceAfterLeaderboard(room, 0)).toEqual({ finished: true });
    expect(room.phase).toBe("final");
  });
});
