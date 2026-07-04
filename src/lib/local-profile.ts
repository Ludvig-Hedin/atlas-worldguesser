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
  /** Country codes with a building avatar unlocked (guest-local, merged into the cloud account on sign-in). */
  unlockedBuildings: string[];
  recent: RecentGame[];
  /** Flags-mode progress: best score per region + games played. */
  flag: { bests: Record<string, number>; gamesPlayed: number };
}

export function emptyProfile(): LocalProfile {
  return {
    username: "Guest",
    stats: { ...EMPTY_STATS },
    streaks: { ...EMPTY_STREAKS },
    achievements: [],
    unlockedBuildings: [],
    recent: [],
    flag: { bests: {}, gamesPlayed: 0 },
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
      unlockedBuildings: parsed.unlockedBuildings ?? [],
      recent: parsed.recent ?? [],
      flag: {
        bests: parsed.flag?.bests ?? {},
        gamesPlayed: parsed.flag?.gamesPlayed ?? 0,
      },
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
    unlockedBuildings: profile.unlockedBuildings,
  };
}

/** Whether a guest profile has anything worth importing into a new account. */
export function hasGuestProgress(profile: LocalProfile): boolean {
  // XP alone counts — a guest who only played Flags earns XP but no distance games.
  return profile.stats.gamesPlayed > 0 || profile.stats.xp > 0;
}

export interface FlagApplyResult {
  profile: LocalProfile;
  xpGained: number;
  /** Best score for the region after this run. */
  best: number;
  /** Whether this run set a new regional best. */
  bestBeaten: boolean;
}

/**
 * Fold a finished Flags run into a guest profile. XP goes into the same pool as
 * distance games (so levels are unified); flag bests/plays are tracked
 * separately, namespaced by mode so a Flags best and a Countries best for the
 * same region don't overwrite each other. Does not touch distance-game stats
 * (gamesPlayed/wins).
 */
export function applyFlagResult(
  profile: LocalProfile,
  input: { region: string; mode: "flag" | "name"; score: number; xpGained: number },
): FlagApplyResult {
  const key = `${input.mode}:${input.region}`;
  const prevBest = profile.flag.bests[key] ?? 0;
  const best = Math.max(prevBest, input.score);
  return {
    profile: {
      ...profile,
      stats: { ...profile.stats, xp: profile.stats.xp + input.xpGained },
      flag: {
        bests: { ...profile.flag.bests, [key]: best },
        gamesPlayed: profile.flag.gamesPlayed + 1,
      },
    },
    xpGained: input.xpGained,
    best,
    bestBeaten: input.score > prevBest,
  };
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
  newBuildings: string[];
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
    unlockedBuildings: profile.unlockedBuildings,
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
      unlockedBuildings: [...profile.unlockedBuildings, ...out.newBuildings],
      recent,
    },
    xpGained: out.xpGained,
    newAchievements: out.newAchievements,
    newBuildings: out.newBuildings,
    leveledUp: out.leveledUp,
    won: out.won,
    totalScore: out.totalScore,
  };
}
