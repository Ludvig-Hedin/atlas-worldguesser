import { describe, expect, it } from "vitest";
import { foldGame, EMPTY_STREAKS, isSoloWin } from "./progression";
import { EMPTY_STATS, type RoundResult } from "./types";

const perfect: RoundResult = {
  round: 1,
  actual: { lat: 48.85, lng: 2.35, countryCode: "FR" },
  guess: { lat: 48.85, lng: 2.35 },
  distanceMeters: 10,
  score: 5000,
  timeMs: 1000,
  guessCountryCode: "FR",
  countryCorrect: true,
};
const missed: RoundResult = {
  round: 2,
  actual: { lat: 35.68, lng: 139.75, countryCode: "JP" },
  guess: null,
  distanceMeters: 15_000_000,
  score: 0,
  timeMs: 2000,
  guessCountryCode: null,
  countryCorrect: false,
};

const NOW = 1_700_000_000_000;

describe("foldGame", () => {
  it("accumulates stats and xp", () => {
    const out = foldGame({
      stats: { ...EMPTY_STATS },
      streaks: { ...EMPTY_STREAKS },
      ownedAchievements: [],
      unlockedBuildings: [],
      results: [perfect, missed],
      now: NOW,
    });
    expect(out.stats.gamesPlayed).toBe(1);
    expect(out.stats.roundsPlayed).toBe(2);
    expect(out.stats.bestScore).toBe(5000);
    expect(out.stats.countryCorrect).toBe(1);
    expect(out.stats.countryTotal).toBe(1); // only one round had a guess
    expect(out.xpGained).toBe(1100); // 1000 + 100 pinpoint bonus
    expect(out.stats.xp).toBe(1100);
    expect(out.totalScore).toBe(5000);
  });

  it("unlocks the expected achievements", () => {
    const out = foldGame({
      stats: { ...EMPTY_STATS },
      streaks: { ...EMPTY_STREAKS },
      ownedAchievements: [],
      unlockedBuildings: [],
      results: [perfect, missed],
      now: NOW,
    });
    expect(out.newAchievements).toContain("first_game");
    expect(out.newAchievements).toContain("bullseye");
    expect(out.newAchievements).toContain("local_expert");
  });

  it("unlocks a curated building on a correct country guess", () => {
    const out = foldGame({
      stats: { ...EMPTY_STATS },
      streaks: { ...EMPTY_STREAKS },
      ownedAchievements: [],
      unlockedBuildings: [],
      results: [perfect, missed],
      now: NOW,
    });
    expect(out.newBuildings).toEqual(["FR"]);
  });

  it("does not re-unlock an already-owned building", () => {
    const out = foldGame({
      stats: { ...EMPTY_STATS },
      streaks: { ...EMPTY_STREAKS },
      ownedAchievements: [],
      unlockedBuildings: ["FR"],
      results: [perfect, missed],
      now: NOW,
    });
    expect(out.newBuildings).toEqual([]);
  });

  it("resets the country streak on a wrong round", () => {
    const out = foldGame({
      stats: { ...EMPTY_STATS },
      streaks: { ...EMPTY_STREAKS, country: 3 },
      ownedAchievements: [],
      unlockedBuildings: [],
      results: [perfect, missed],
      now: NOW,
    });
    expect(out.streaks.country).toBe(0);
    expect(out.streaks.daily).toBe(1);
  });

  it("records a country-streak peak that breaks before the game ends", () => {
    // 3 (carried) + 1 correct = 4, then broken by the miss: the peak must
    // still land in bestCountry even though the live streak ends at 0.
    const out = foldGame({
      stats: { ...EMPTY_STATS },
      streaks: { ...EMPTY_STREAKS, country: 3, bestCountry: 3 },
      ownedAchievements: [],
      unlockedBuildings: [],
      results: [perfect, missed],
      now: NOW,
    });
    expect(out.streaks.country).toBe(0);
    expect(out.streaks.bestCountry).toBe(4);
  });

  it("honors a multiplayer win override", () => {
    const out = foldGame({
      stats: { ...EMPTY_STATS },
      streaks: { ...EMPTY_STREAKS },
      ownedAchievements: [],
      unlockedBuildings: [],
      results: [missed],
      now: NOW,
      wonOverride: true,
    });
    expect(out.won).toBe(true);
    expect(out.stats.wins).toBe(1);
    expect(out.streaks.win).toBe(1);
  });
});

describe("isSoloWin", () => {
  it("requires 60% of the max", () => {
    expect(isSoloWin(15_000, 5)).toBe(true); // 60% of 25000
    expect(isSoloWin(14_999, 5)).toBe(false);
    expect(isSoloWin(100, 0)).toBe(false);
  });
});
