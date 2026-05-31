import { describe, expect, test } from "vitest";
import { assembleOptions, normalizeAnswer } from "./options";

describe("assembleOptions", () => {
  test("includes the truth and one option per unique lie", () => {
    const opts = assembleOptions("Paris", ["Lyon", "Nice"], { a: "Berlin", b: "Madrid" });
    const truth = opts.filter((o) => o.source === "truth");
    expect(truth).toHaveLength(1);
    expect(truth[0]!.text).toBe("Paris");
    const playerTexts = opts.filter((o) => o.source === "player").map((o) => o.text).sort();
    expect(playerTexts).toEqual(["Berlin", "Madrid"]);
  });

  test("drops a lie equal to the truth (case/space-insensitive)", () => {
    const opts = assembleOptions("Salt", ["Pepper"], { a: " salt ", b: "Sugar" });
    expect(opts.some((o) => normalizeAnswer(o.text) === "salt" && o.source === "player")).toBe(false);
    expect(opts.filter((o) => o.source === "player").map((o) => o.text)).toEqual(["Sugar"]);
  });

  test("merges identical lies from 2+ players into one option crediting all authors", () => {
    const opts = assembleOptions("Truth", ["Decoy1"], { a: "Berlin", b: "berlin", c: "BERLIN" });
    const merged = opts.filter((o) => o.source === "player");
    expect(merged).toHaveLength(1);
    expect(merged[0]!.authorIds.sort()).toEqual(["a", "b", "c"]);
  });

  test("a 2-player game is padded with decoys to reach MIN_OPTIONS (4)", () => {
    const opts = assembleOptions("Truth", ["D1", "D2", "D3"], { a: "Lie A", b: "Lie B" });
    expect(opts.length).toBeGreaterThanOrEqual(4);
    // 1 truth + 2 lies + 1 decoy = 4
    expect(opts.filter((o) => o.source === "decoy").length).toBe(1);
  });

  test("does not pad with a decoy that collides with the truth or a lie", () => {
    const opts = assembleOptions("Truth", ["truth", "Lie A", "Fresh"], { a: "Lie A" });
    // decoys "truth" (==truth) and "Lie A" (==a lie) are skipped; "Fresh" is used.
    const decoyTexts = opts.filter((o) => o.source === "decoy").map((o) => o.text);
    expect(decoyTexts).toEqual(["Fresh"]);
  });

  test("every option appears exactly once with a unique id (no drops/dupes)", () => {
    const opts = assembleOptions("Truth", ["D1", "D2"], { a: "A", b: "B", c: "C" });
    const ids = opts.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    const texts = opts.map((o) => o.text).sort();
    expect(texts).toEqual(["A", "B", "C", "Truth"]); // 4 already, no decoys needed
  });
});
