import {
  countPerfectRounds,
  newlyUnlocked,
  type AchievementContext,
} from "./achievements";
import { maxMatchScore } from "./scoring";
import { levelForXp, xpForGame } from "./xp";
import type { PlayerStats, RoundResult } from "./types";

/**
 * Pure progression logic shared by the guest (localStorage) and cloud (Convex)
 * paths so stats, streaks, and achievement unlocks are computed identically.
 */

export interface StreakState {
  daily: number;
  lastPlayedDay: number;
  win: number;
  bestWin: number;
  country: number;
  bestCountry: number;
}

export const EMPTY_STREAKS: StreakState = {
  daily: 0,
  lastPlayedDay: 0,
  win: 0,
  bestWin: 0,
  country: 0,
  bestCountry: 0,
};

/** A solo game counts as a "win" when the player averages a strong 3000+/round. */
export function isSoloWin(totalScore: number, rounds: number): boolean {
  return rounds > 0 && totalScore >= 0.6 * maxMatchScore(rounds);
}

export interface ProgressionInput {
  stats: PlayerStats;
  streaks: StreakState;
  ownedAchievements: string[];
  results: RoundResult[];
  now: number;
  /** Override the "won" determination (e.g. multiplayer placement). */
  wonOverride?: boolean;
}

export interface ProgressionOutput {
  stats: PlayerStats;
  streaks: StreakState;
  newAchievements: string[];
  xpGained: number;
  leveledUp: boolean;
  won: boolean;
  totalScore: number;
  perfectRounds: number;
  avgDistanceMeters: number;
}

const dayNumber = (ts: number) => Math.floor(ts / 86_400_000);

/** Fold a finished game's results into stats + streaks, returning deltas. */
export function foldGame(input: ProgressionInput): ProgressionOutput {
  const { stats: prev, streaks: s, ownedAchievements, results, now } = input;
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
  let daily: number;
  if (s.lastPlayedDay === today) daily = Math.max(1, s.daily);
  else if (s.lastPlayedDay === today - 1) daily = s.daily + 1;
  else daily = 1;

  const win = won ? s.win + 1 : 0;

  // Track the peak inside the game too — a streak that breaks before the last
  // round would otherwise never be recorded in bestCountry.
  let country = s.country;
  let bestCountry = s.bestCountry;
  for (const r of results) {
    country = r.countryCorrect ? country + 1 : 0;
    bestCountry = Math.max(bestCountry, country);
  }

  const streaks: StreakState = {
    daily,
    lastPlayedDay: today,
    win,
    bestWin: Math.max(s.bestWin, win),
    country,
    bestCountry,
  };

  const ctx: AchievementContext = {
    stats,
    streaks: { daily: streaks.daily, win: streaks.win, country: streaks.country },
    lastGame: { results, totalScore, perfectRounds, won },
  };
  const newAchievements = newlyUnlocked(ctx, ownedAchievements);

  return {
    stats,
    streaks,
    newAchievements,
    xpGained,
    leveledUp,
    won,
    totalScore,
    perfectRounds,
    avgDistanceMeters: rounds ? distanceSum / rounds : 0,
  };
}
