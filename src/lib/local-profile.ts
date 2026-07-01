import {
  countPerfectRounds,
  newlyUnlocked,
  type AchievementContext,
} from "./achievements";
import { maxMatchScore } from "./scoring";
import { levelForXp, xpForGame } from "./xp";
import { EMPTY_STATS, type PlayerStats, type RoundResult } from "./types";

const STORAGE_KEY = "atlas:profile:v1";

export interface Streaks {
  daily: number;
  lastPlayedDay: number;
  win: number;
  bestWin: number;
  country: number;
  bestCountry: number;
}

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

const EMPTY_STREAKS: Streaks = {
  daily: 0,
  lastPlayedDay: 0,
  win: 0,
  bestWin: 0,
  country: 0,
  bestCountry: 0,
};

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

const dayNumber = (ts: number) => Math.floor(ts / 86_400_000);

/** A solo game counts as a "win" when the player averages a strong 3000+/round. */
export function isSoloWin(totalScore: number, rounds: number): boolean {
  return rounds > 0 && totalScore >= 0.6 * maxMatchScore(rounds);
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
  const { results } = game;
  const rounds = results.length;
  const totalScore = results.reduce((s, r) => s + r.score, 0);
  const distanceSum = results.reduce((s, r) => s + r.distanceMeters, 0);
  const guessed = results.filter((r) => r.guess !== null);
  const countryCorrect = results.filter((r) => r.countryCorrect).length;
  const xpGained = xpForGame(results);
  const won = isSoloWin(totalScore, rounds);
  const perfectRounds = countPerfectRounds(results);

  const prevLevel = levelForXp(profile.stats.xp);
  const stats: PlayerStats = {
    gamesPlayed: profile.stats.gamesPlayed + 1,
    roundsPlayed: profile.stats.roundsPlayed + rounds,
    wins: profile.stats.wins + (won ? 1 : 0),
    bestScore: Math.max(profile.stats.bestScore, totalScore),
    totalDistanceMeters: profile.stats.totalDistanceMeters + distanceSum,
    countryCorrect: profile.stats.countryCorrect + countryCorrect,
    countryTotal: profile.stats.countryTotal + guessed.length,
    xp: profile.stats.xp + xpGained,
  };
  const leveledUp = levelForXp(stats.xp) > prevLevel;

  // Streaks
  const today = dayNumber(now);
  const s = profile.streaks;
  let daily = s.daily;
  if (s.lastPlayedDay === today) daily = Math.max(1, s.daily);
  else if (s.lastPlayedDay === today - 1) daily = s.daily + 1;
  else daily = 1;

  const win = won ? s.win + 1 : 0;

  // Country streak folds through the game's rounds in order.
  let country = s.country;
  for (const r of results) country = r.countryCorrect ? country + 1 : 0;

  const streaks: Streaks = {
    daily,
    lastPlayedDay: today,
    win,
    bestWin: Math.max(s.bestWin, win),
    country,
    bestCountry: Math.max(s.bestCountry, country),
  };

  const ctx: AchievementContext = {
    stats,
    streaks: { daily: streaks.daily, win: streaks.win, country: streaks.country },
    lastGame: { results, totalScore, perfectRounds, won },
  };
  const newAchievements = newlyUnlocked(ctx, profile.achievements);

  const recent: RecentGame[] = [
    {
      id: game.id,
      mapId: game.mapId,
      totalScore,
      rounds,
      avgDistanceMeters: guessed.length ? distanceSum / rounds : distanceSum / Math.max(1, rounds),
      perfectRounds,
      won,
      playedAt: now,
    },
    ...profile.recent,
  ].slice(0, 12);

  return {
    profile: {
      ...profile,
      stats,
      streaks,
      achievements: [...profile.achievements, ...newAchievements],
      recent,
    },
    xpGained,
    newAchievements,
    leveledUp,
    won,
    totalScore,
  };
}
