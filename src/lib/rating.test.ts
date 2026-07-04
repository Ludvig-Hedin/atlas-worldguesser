import { describe, expect, it } from "vitest";
import {
  DEFAULT_RATING,
  RATING_TIERS,
  computeRatingDelta,
  kFactorFor,
  tierForRating,
} from "./rating";

describe("DEFAULT_RATING", () => {
  it("is 1000", () => {
    expect(DEFAULT_RATING).toBe(1000);
  });
});

describe("tierForRating", () => {
  it("maps the five fixed bands at their boundaries", () => {
    expect(tierForRating(0).key).toBe("bronze");
    expect(tierForRating(899).key).toBe("bronze");
    expect(tierForRating(900).key).toBe("silver");
    expect(tierForRating(1099).key).toBe("silver");
    expect(tierForRating(1100).key).toBe("gold");
    expect(tierForRating(1299).key).toBe("gold");
    expect(tierForRating(1300).key).toBe("platinum");
    expect(tierForRating(1499).key).toBe("platinum");
    expect(tierForRating(1500).key).toBe("diamond");
    expect(tierForRating(5000).key).toBe("diamond");
  });

  it("clamps below the lowest band to bronze", () => {
    expect(tierForRating(-500).key).toBe("bronze");
  });

  it("the default rating sits in silver", () => {
    expect(tierForRating(DEFAULT_RATING).key).toBe("silver");
  });

  it("bands are ascending and contiguous", () => {
    for (let i = 1; i < RATING_TIERS.length; i++) {
      expect(RATING_TIERS[i].min).toBeGreaterThan(RATING_TIERS[i - 1].min);
    }
  });
});

describe("computeRatingDelta", () => {
  it("evenly matched: winning gains +k/2, losing loses k/2", () => {
    // E = 0.5 when ratings are equal → delta = round(k * (1 - 0.5)) = k/2.
    expect(computeRatingDelta({ myRating: 1000, avgOpponentRating: 1000, won: true, k: 32 })).toBe(16);
    expect(computeRatingDelta({ myRating: 1000, avgOpponentRating: 1000, won: false, k: 32 })).toBe(-16);
  });

  it("is zero-sum between two evenly matched players (classical 2-player Elo)", () => {
    const winner = computeRatingDelta({ myRating: 1200, avgOpponentRating: 1200, won: true, k: 32 });
    const loser = computeRatingDelta({ myRating: 1200, avgOpponentRating: 1200, won: false, k: 32 });
    expect(winner + loser).toBe(0);
  });

  it("beating a stronger opponent gains more than beating a weaker one", () => {
    const beatStronger = computeRatingDelta({ myRating: 1000, avgOpponentRating: 1400, won: true, k: 32 });
    const beatWeaker = computeRatingDelta({ myRating: 1000, avgOpponentRating: 600, won: true, k: 32 });
    expect(beatStronger).toBeGreaterThan(beatWeaker);
  });

  it("losing to a weaker opponent costs more than losing to a stronger one", () => {
    const lostToWeaker = computeRatingDelta({ myRating: 1400, avgOpponentRating: 1000, won: false, k: 32 });
    const lostToStronger = computeRatingDelta({ myRating: 1000, avgOpponentRating: 1400, won: false, k: 32 });
    expect(lostToWeaker).toBeLessThan(lostToStronger);
  });

  it("a larger K-factor moves the rating further", () => {
    const settled = computeRatingDelta({ myRating: 1000, avgOpponentRating: 1000, won: true, k: 32 });
    const placement = computeRatingDelta({ myRating: 1000, avgOpponentRating: 1000, won: true, k: 60 });
    expect(placement).toBeGreaterThan(settled);
    expect(placement).toBe(30);
  });

  it("returns an integer (rounded) delta", () => {
    const d = computeRatingDelta({ myRating: 1023, avgOpponentRating: 1187, won: true, k: 32 });
    expect(Number.isInteger(d)).toBe(true);
  });
});

describe("kFactorFor", () => {
  it("uses the larger placement K for the first five games, then settles", () => {
    expect(kFactorFor(0)).toBe(60);
    expect(kFactorFor(4)).toBe(60);
    expect(kFactorFor(5)).toBe(32);
    expect(kFactorFor(50)).toBe(32);
  });
});
