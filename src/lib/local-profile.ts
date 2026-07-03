import { EMPTY_STREAKS, foldGame, isSoloWin, type StreakState } from "./progression";
import { EMPTY_STATS, type PlayerStats, type RoundResult } from "./types";

export { isSoloWin };
export type Streaks = StreakState;

const STORAGE_KEY = "atlas:profile:v1";

export interface RecentGame {
  id: string;
  mapId: string;
  totalScore: number;
  rounds: number;
  avgDistanceMeters: number;
  perfectRounds: number;
  won: boolean;
  playedAt: number;
}

export interface LocalProfile {
  username: string;
  stats: PlayerStats;
  streaks: Streaks;
  achievements: string[];
  recent: RecentGame[];
}

export function emptyProfile(): LocalProfile {
  return {
    username: "Guest",
    stats: { ...EMPTY_STATS },
    streaks: { ...EMPTY_STREAKS },
    achievements: [],
    recent: [],
  };
}

export function loadProfile(): LocalProfile {
  if (typeof window === "undefined") return emptyProfile();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw) as Partial<LocalProfile>;
    return {
      ...emptyProfile(),
      ...parsed,
      stats: { ...EMPTY_STATS, ...parsed.stats },
      streaks: { ...EMPTY_STREAKS, ...parsed.streaks },
      achievements: parsed.achievements ?? [],
      recent: parsed.recent ?? [],
    };
  } catch {
    return emptyProfile();
  }
}

export function saveProfile(profile: LocalProfile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // storage full / disabled — non-fatal
  }
}

/**
 * Payload for the one-time guest→cloud import (api.users.importGuestProfile).
 * The cloud user separates `xp` from `stats`, so we peel it off here.
 */
export function guestImportPayload(profile: LocalProfile) {
  const { xp, ...statsNoXp } = profile.stats;
  return {
    xp,
    stats: statsNoXp,
    streaks: profile.streaks,
    achievements: profile.achievements,
  };
}

/** Whether a guest profile has anything worth importing into a new account. */
export function hasGuestProgress(profile: LocalProfile): boolean {
  return profile.stats.gamesPlayed > 0;
}

export interface GameSummary {
  id: string;
  mapId: string;
  results: RoundResult[];
}

export interface ApplyResult {
  profile: LocalProfile;
  xpGained: number;
  newAchievements: string[];
  leveledUp: boolean;
  won: boolean;
  totalScore: number;
}

/** Fold a finished game into a profile, returning the new profile + deltas. */
export function applyGame(
  profile: LocalProfile,
  game: GameSummary,
  now = Date.now(),
): ApplyResult {
  const out = foldGame({
    stats: profile.stats,
    streaks: profile.streaks,
    ownedAchievements: profile.achievements,
    results: game.results,
    now,
  });

  const recent: RecentGame[] = [
    {
      id: game.id,
      mapId: game.mapId,
      totalScore: out.totalScore,
      rounds: game.results.length,
      avgDistanceMeters: out.avgDistanceMeters,
      perfectRounds: out.perfectRounds,
      won: out.won,
      playedAt: now,
    },
    ...profile.recent,
  ].slice(0, 12);

  return {
    profile: {
      ...profile,
      stats: out.stats,
      streaks: out.streaks,
      achievements: [...profile.achievements, ...out.newAchievements],
      recent,
    },
    xpGained: out.xpGained,
    newAchievements: out.newAchievements,
    leveledUp: out.leveledUp,
    won: out.won,
    totalScore: out.totalScore,
  };
}
