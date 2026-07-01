import { describe, expect, it } from "vitest";
import { xpForRound, xpForGame, levelForXp, totalXpForLevel, levelProgress } from "./xp";

describe("xpForRound", () => {
  it("gives a perfect pinpoint round base + bonus", () => {
    expect(xpForRound({ score: 5000, distanceMeters: 10 })).toBe(1000 + 100);
  });
  it("gives no pinpoint bonus for far guesses", () => {
    expect(xpForRound({ score: 2500, distanceMeters: 500_000 })).toBe(500);
  });
});

describe("xpForGame", () => {
  it("sums per-round xp", () => {
    const xp = xpForGame([
      { score: 5000, distanceMeters: 10 },
      { score: 0, distanceMeters: 5_000_000 },
    ]);
    expect(xp).toBe(1100);
  });
});

describe("levels", () => {
  it("starts at level 1 with 0 xp", () => {
    expect(levelForXp(0)).toBe(1);
    expect(totalXpForLevel(1)).toBe(0);
  });

  it("round-trips level thresholds", () => {
    for (let level = 1; level <= 30; level++) {
      expect(levelForXp(totalXpForLevel(level))).toBe(level);
      expect(levelForXp(totalXpForLevel(level + 1) - 1)).toBe(level);
    }
  });

  it("produces progress within [0,1]", () => {
    const p = levelProgress(1500);
    expect(p.fraction).toBeGreaterThanOrEqual(0);
    expect(p.fraction).toBeLessThanOrEqual(1);
    expect(p.into + p.xpToNext).toBe(p.span);
  });
});
