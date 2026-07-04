import {
  countPerfectRounds,
  newlyUnlocked,
  type AchievementContext,
} from "./achievements";
import { newlyUnlockedBuildings } from "./buildings";
import { maxMatchScore } from "./scoring";
import { levelForXp, xpForGame } from "./xp";
import type { PlayerStats, RoundResult } from "./types";

/**
 * Pure progression logic shared by the guest (localStorage) and cloud (Convex)
 * paths so stats, streaks, and achievement unlocks are computed identically.
 */

export interface CountryMapStreak {
  current: number;
  best: number;
}

export interface StreakState {
  daily: number;
  lastPlayedDay: number;
  win: number;
  bestWin: number;
  /** Country-correct streak, segmented per map id (e.g. "world", "usa"). */
  countryByMap: Record<string, CountryMapStreak>;
  /**
   * Banked daily-streak "freezes". Each auto-bridges exactly one missed day so
   * a single skipped day doesn't reset the daily play streak (see foldGame).
   * Earned at every 7-day milestone, capped at 3. Optional so pre-feature rows
   * and stored guest profiles (which lack it) stay assignable; read as 0.
   */
  freezesAvailable?: number;
}

export const EMPTY_STREAKS: StreakState = {
  daily: 0,
  lastPlayedDay: 0,
  win: 0,
  bestWin: 0,
  countryByMap: {},
  freezesAvailable: 0,
};

/**
 * Pre-per-map streaks stored one flat `country`/`bestCountry` pair — implicitly
 * the "world" map, since Survival always played World before this shipped. Fold
 * it into `countryByMap.world` exactly once: if `countryByMap` is already
 * present the account has migrated, and any lingering legacy numbers in
 * storage are ignored from then on.
 */
export function resolveCountryByMap(streaks: {
  countryByMap?: Record<string, CountryMapStreak>;
  country?: number;
  bestCountry?: number;
}): Record<string, CountryMapStreak> {
  if (streaks.countryByMap) return streaks.countryByMap;
  if (!streaks.country && !streaks.bestCountry) return {};
  return { world: { current: streaks.country ?? 0, best: streaks.bestCountry ?? 0 } };
}

/** Best streak across every map — used for the profile page's aggregate summary. */
export function bestCountryStreakOf(
  countryByMap: Record<string, CountryMapStreak>,
): number | undefined {
  const bests = Object.values(countryByMap).map((m) => m.best);
  return bests.length ? Math.max(...bests) : undefined;
}

/** A solo game counts as a "win" when the player averages a strong 3000+/round. */
export function isSoloWin(totalScore: number, rounds: number): boolean {
  return rounds > 0 && totalScore >= 0.6 * maxMatchScore(rounds);
}

export interface ProgressionInput {
  stats: PlayerStats;
  streaks: StreakState;
  ownedAchievements: string[];
  /** Country codes with a building avatar already unlocked. */
  unlockedBuildings: string[];
  results: RoundResult[];
  now: number;
  /** Which map's streak counter this game bumps (e.g. "world", "usa"). */
  mapId: string;
  /** Override the "won" determination (e.g. multiplayer placement). */
  wonOverride?: boolean;
}

export interface ProgressionOutput {
  stats: PlayerStats;
  streaks: StreakState;
  newAchievements: string[];
  /** Country codes with a building newly unlocked by this game. */
  newBuildings: string[];
  xpGained: number;
  leveledUp: boolean;
  /** A banked freeze was auto-spent to bridge a one-day gap and save the daily streak. */
  streakFreezeUsed: boolean;
  won: boolean;
  totalScore: number;
  perfectRounds: number;
  avgDistanceMeters: number;
}

const dayNumber = (ts: number) => Math.floor(ts / 86_400_000);

/** Fold a finished game's results into stats + streaks, returning deltas. */
export function foldGame(input: ProgressionInput): ProgressionOutput {
  const { stats: prev, streaks: s, ownedAchievements, results, now, mapId } = input;
  const rounds = results.length;
  const totalScore = results.reduce((a, r) => a + r.score, 0);
  const distanceSum = results.reduce((a, r) => a + r.distanceMeters, 0);
  const guessed = results.filter((r) => r.guess !== null);
  const countryCorrect = results.filter((r) => r.countryCorrect).length;
  const xpGained = xpForGame(results);
  const won = input.wonOverride ?? isSoloWin(totalScore, rounds);
  const perfectRounds = countPerfectRounds(results);
  const prevLevel = levelForXp(prev.xp);

  const stats: PlayerStats = {
    gamesPlayed: prev.gamesPlayed + 1,
    roundsPlayed: prev.roundsPlayed + rounds,
    wins: prev.wins + (won ? 1 : 0),
    bestScore: Math.max(prev.bestScore, totalScore),
    totalDistanceMeters: prev.totalDistanceMeters + distanceSum,
    countryCorrect: prev.countryCorrect + countryCorrect,
    countryTotal: prev.countryTotal + guessed.length,
    xp: prev.xp + xpGained,
  };
  const leveledUp = levelForXp(stats.xp) > prevLevel;

  const today = dayNumber(now);
  let freezesAvailable = s.freezesAvailable ?? 0;
  let streakFreezeUsed = false;
  let daily: number;
  if (s.lastPlayedDay === today) {
    daily = Math.max(1, s.daily);
  } else if (s.lastPlayedDay === today - 1) {
    daily = s.daily + 1;
  } else if (s.daily > 0 && today - s.lastPlayedDay === 2 && freezesAvailable > 0) {
    // Bridges exactly one missed day; a longer gap still breaks the streak.
    // `s.daily > 0` keeps a brand-new account from ever spending a freeze on
    // what isn't really a "returning" gap.
    daily = s.daily + 1;
    freezesAvailable -= 1;
    streakFreezeUsed = true;
  } else {
    daily = 1;
  }
  // Earn one freeze at every 7-day milestone (7, 14, 21…), capped at 3. Guarded
  // by `daily > s.daily` so replaying on a milestone day can't farm freezes.
  if (daily > s.daily && daily % 7 === 0) {
    freezesAvailable = Math.min(3, freezesAvailable + 1);
  }

  const win = won ? s.win + 1 : 0;

  // Track the peak inside the game too — a streak that breaks before the last
  // round would otherwise never be recorded as this map's best.
  const prevMapStreak = s.countryByMap[mapId] ?? { current: 0, best: 0 };
  let country = prevMapStreak.current;
  let best = prevMapStreak.best;
  for (const r of results) {
    country = r.countryCorrect ? country + 1 : 0;
    best = Math.max(best, country);
  }
  const countryByMap: Record<string, CountryMapStreak> = {
    ...s.countryByMap,
    [mapId]: { current: country, best },
  };

  const streaks: StreakState = {
    daily,
    lastPlayedDay: today,
    win,
    bestWin: Math.max(s.bestWin, win),
    countryByMap,
    freezesAvailable,
  };

  const ctx: AchievementContext = {
    stats,
    streaks: { daily: streaks.daily, win: streaks.win, country },
    lastGame: { results, totalScore, perfectRounds, won },
  };
  const newAchievements = newlyUnlocked(ctx, ownedAchievements);
  const newBuildings = newlyUnlockedBuildings(results, input.unlockedBuildings);

  return {
    stats,
    streaks,
    newAchievements,
    newBuildings,
    xpGained,
    leveledUp,
    streakFreezeUsed,
    won,
    totalScore,
    perfectRounds,
    avgDistanceMeters: rounds ? distanceSum / rounds : 0,
  };
}
