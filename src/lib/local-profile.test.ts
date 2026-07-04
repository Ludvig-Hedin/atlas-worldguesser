import { describe, expect, it, beforeEach } from "vitest";
import {
  applyGame,
  emptyProfile,
  guestImportPayload,
  loadProfile,
  type LocalProfile,
} from "./local-profile";
import { EMPTY_STREAKS } from "./progression";
import type { RoundResult } from "./types";

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

describe("applyGame", () => {
  it("segments the country streak by mapId", () => {
    const profile = emptyProfile();
    const afterWorld = applyGame(profile, { id: "g1", mapId: "world", results: [perfect] });
    const afterUsa = applyGame(afterWorld.profile, { id: "g2", mapId: "usa", results: [perfect] });

    expect(afterUsa.profile.streaks.countryByMap.world).toEqual({ current: 1, best: 1 });
    expect(afterUsa.profile.streaks.countryByMap.usa).toEqual({ current: 1, best: 1 });
  });
});

describe("loadProfile", () => {
  const STORAGE_KEY = "atlas:profile:v1";

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("folds a legacy flat country/bestCountry pair into countryByMap.world", () => {
    const legacy = {
      username: "Guest",
      stats: { gamesPlayed: 1, roundsPlayed: 1, wins: 0, bestScore: 5000, totalDistanceMeters: 10, countryCorrect: 1, countryTotal: 1, xp: 1100 },
      streaks: { daily: 1, lastPlayedDay: 20000, win: 0, bestWin: 0, country: 4, bestCountry: 6 },
      achievements: [],
      unlockedBuildings: [],
      recent: [],
      flag: { bests: {}, gamesPlayed: 0 },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    const profile = loadProfile();
    expect(profile.streaks.countryByMap).toEqual({ world: { current: 4, best: 6 } });
    // The legacy fields must not leak into the normalized in-memory shape.
    expect(profile.streaks).not.toHaveProperty("country");
    expect(profile.streaks).not.toHaveProperty("bestCountry");
  });

  it("leaves an already-migrated countryByMap untouched", () => {
    const migrated: LocalProfile = {
      ...emptyProfile(),
      streaks: { ...EMPTY_STREAKS, countryByMap: { usa: { current: 2, best: 9 } } },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));

    const profile = loadProfile();
    expect(profile.streaks.countryByMap).toEqual({ usa: { current: 2, best: 9 } });
  });

  it("defaults to an empty countryByMap for a brand-new profile", () => {
    expect(loadProfile().streaks.countryByMap).toEqual({});
  });
});

describe("guestImportPayload", () => {
  it("never emits legacy country/bestCountry fields", () => {
    const profile: LocalProfile = {
      ...emptyProfile(),
      streaks: { ...EMPTY_STREAKS, countryByMap: { world: { current: 1, best: 1 } } },
    };
    const payload = guestImportPayload(profile);
    expect(payload.streaks).not.toHaveProperty("country");
    expect(payload.streaks).not.toHaveProperty("bestCountry");
    expect(payload.streaks.countryByMap).toEqual({ world: { current: 1, best: 1 } });
  });
});
