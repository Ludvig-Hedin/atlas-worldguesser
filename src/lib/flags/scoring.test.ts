import { describe, expect, it } from "vitest";
import {
  FLAG_MAX_SCORE,
  FLAG_MAX_WRONG,
  flagRoundScore,
  flagRunScore,
  flagWarnLevel,
  flagXpForRun,
} from "./scoring";

describe("flagRoundScore", () => {
  it("decays with each wrong click", () => {
    expect(flagRoundScore(0)).toBe(1000);
    expect(flagRoundScore(1)).toBe(600);
    expect(flagRoundScore(2)).toBe(300);
  });

  it("is 0 once the answer is revealed", () => {
    expect(flagRoundScore(FLAG_MAX_WRONG)).toBe(0);
    expect(flagRoundScore(4)).toBe(0);
    expect(flagRoundScore(99)).toBe(0);
  });

  it("clamps negative/fractional input", () => {
    expect(flagRoundScore(-1)).toBe(1000);
    expect(flagRoundScore(1.9)).toBe(600);
  });

  it("a first-click solve earns the max", () => {
    expect(flagRoundScore(0)).toBe(FLAG_MAX_SCORE);
  });
});

describe("flagRunScore", () => {
  it("sums per-flag scores", () => {
    expect(flagRunScore([0, 1, 2, 3])).toBe(1000 + 600 + 300 + 0);
  });

  it("is 0 for an empty run", () => {
    expect(flagRunScore([])).toBe(0);
  });
});

describe("flagXpForRun", () => {
  it("is a fifth of the run score", () => {
    expect(flagXpForRun([0, 0])).toBe(400); // 2000 / 5
    expect(flagXpForRun([0])).toBe(200); // perfect flag = 200 XP
    expect(flagXpForRun([3])).toBe(0);
  });
});

describe("flagWarnLevel", () => {
  it("escalates amber → orange → red", () => {
    expect(flagWarnLevel(1)).toBe(1);
    expect(flagWarnLevel(2)).toBe(2);
    expect(flagWarnLevel(3)).toBe(3);
    expect(flagWarnLevel(4)).toBe(3);
  });
});
