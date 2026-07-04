import { describe, expect, it } from "vitest";
import { BUILDINGS, BUILDING_LIST, AVATAR_COLORS, evaluateBuildingUnlocks, newlyUnlockedBuildings } from "./buildings";
import type { RoundResult } from "./types";

function round(countryCode: string, countryCorrect: boolean): RoundResult {
  return {
    round: 1,
    actual: { lat: 0, lng: 0, countryCode },
    guess: { lat: 0, lng: 0 },
    distanceMeters: 0,
    score: 0,
    timeMs: 0,
    guessCountryCode: countryCorrect ? countryCode : null,
    countryCorrect,
  };
}

describe("buildings catalog", () => {
  it("every entry is keyed by its own country code", () => {
    for (const b of BUILDING_LIST) {
      expect(BUILDINGS[b.id]).toBe(b);
    }
  });

  it("has no duplicate country codes", () => {
    const ids = BUILDING_LIST.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every image path is a curated /buildings/<lowercase-cc> asset", () => {
    for (const b of BUILDING_LIST) {
      expect(b.image).toBe(`/buildings/${b.id.toLowerCase()}.png`);
    }
  });

  it("has at least one accent color and a valid default", () => {
    expect(AVATAR_COLORS.length).toBeGreaterThan(0);
  });
});

describe("evaluateBuildingUnlocks", () => {
  it("returns curated country codes guessed correctly", () => {
    expect(evaluateBuildingUnlocks([round("FR", true)])).toEqual(["FR"]);
  });

  it("ignores incorrect guesses", () => {
    expect(evaluateBuildingUnlocks([round("FR", false)])).toEqual([]);
  });

  it("ignores countries with no curated building", () => {
    expect(evaluateBuildingUnlocks([round("XX", true)])).toEqual([]);
  });

  it("dedupes multiple correct rounds for the same country in one game", () => {
    expect(evaluateBuildingUnlocks([round("FR", true), round("FR", true)])).toEqual(["FR"]);
  });
});

describe("newlyUnlockedBuildings", () => {
  it("excludes already-owned buildings", () => {
    expect(newlyUnlockedBuildings([round("FR", true)], ["FR"])).toEqual([]);
  });

  it("returns only the newly earned ones alongside already-owned", () => {
    expect(newlyUnlockedBuildings([round("FR", true), round("IT", true)], ["FR"])).toEqual(["IT"]);
  });
});
