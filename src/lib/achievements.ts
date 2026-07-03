import type { PlayerStats, RoundResult } from "./types";
import { MAX_ROUND_SCORE } from "./types";

export type AchievementTier = "bronze" | "silver" | "gold";

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  /** Emoji glyph (kept dependency-free for portability). */
  icon: string;
  tier: AchievementTier;
}

/** Context supplied after a game finishes to evaluate unlocks. */
export interface AchievementContext {
  stats: PlayerStats;
  streaks: { daily: number; win: number; country: number };
  lastGame: {
    results: RoundResult[];
    totalScore: number;
    perfectRounds: number;
    won: boolean;
  } | null;
}

interface Rule extends AchievementDef {
  test: (ctx: AchievementContext) => boolean;
}

const RULES: Rule[] = [
  {
    id: "first_game",
    name: "First Steps",
    description: "Finish your first game",
    icon: "compass",
    tier: "bronze",
    test: (c) => c.stats.gamesPlayed >= 1,
  },
  {
    id: "bullseye",
    name: "Bullseye",
    description: "Score a perfect 5,000 on a round",
    icon: "target",
    tier: "silver",
    test: (c) => (c.lastGame?.perfectRounds ?? 0) >= 1,
  },
  {
    id: "sharpshooter",
    name: "Sharpshooter",
    description: "Land three perfect rounds in one game",
    icon: "crosshair",
    tier: "gold",
    test: (c) => (c.lastGame?.perfectRounds ?? 0) >= 3,
  },
  {
    id: "globetrotter",
    name: "Globetrotter",
    description: "Play 25 games",
    icon: "plane",
    tier: "silver",
    test: (c) => c.stats.gamesPlayed >= 25,
  },
  {
    id: "cartographer",
    name: "Cartographer",
    description: "Score 20,000+ in a single 5-round game",
    icon: "map",
    tier: "gold",
    // Cap at 5 rounds so a 10-round game can't unlock it at half the skill.
    test: (c) =>
      !!c.lastGame && c.lastGame.results.length <= 5 && c.lastGame.totalScore >= 20000,
  },
  {
    id: "local_expert",
    name: "Local Expert",
    description: "Guess within 1 km of the target",
    icon: "map-pin",
    tier: "silver",
    test: (c) =>
      (c.lastGame?.results ?? []).some((r) => r.distanceMeters < 1000),
  },
  {
    id: "geographer",
    name: "Geographer",
    description: "Identify the correct country 100 times",
    icon: "globe",
    tier: "silver",
    test: (c) => c.stats.countryCorrect >= 100,
  },
  {
    id: "on_fire",
    name: "On Fire",
    description: "Win 5 games in a row",
    icon: "flame",
    tier: "gold",
    test: (c) => c.streaks.win >= 5,
  },
  {
    id: "dedicated",
    name: "Dedicated",
    description: "Keep a 7-day play streak",
    icon: "calendar",
    tier: "gold",
    test: (c) => c.streaks.daily >= 7,
  },
  {
    id: "veteran",
    name: "Veteran",
    description: "Play 500 rounds",
    icon: "medal",
    tier: "gold",
    test: (c) => c.stats.roundsPlayed >= 500,
  },
];

export const ACHIEVEMENTS: AchievementDef[] = RULES.map((r) => ({
  id: r.id,
  name: r.name,
  description: r.description,
  icon: r.icon,
  tier: r.tier,
}));

export const ACHIEVEMENT_MAP: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

/** Count perfect rounds in a result set. */
export function countPerfectRounds(results: readonly RoundResult[]): number {
  return results.filter((r) => r.score >= MAX_ROUND_SCORE).length;
}

export interface AchievementProgress {
  current: number;
  target: number;
  /** 0–1 clamped. */
  fraction: number;
}

/**
 * Progress toward a *cumulative* locked achievement, so the profile can show a
 * "3 / 25 games" style hint. Returns null for skill-feat achievements (e.g.
 * "perfect round") where a running count isn't meaningful.
 */
export function progressForAchievement(
  id: string,
  stats: Pick<PlayerStats, "gamesPlayed" | "roundsPlayed" | "countryCorrect">,
  streaks: { daily: number; win: number },
): AchievementProgress | null {
  const prog = (current: number, target: number): AchievementProgress => ({
    current: Math.max(0, Math.min(current, target)),
    target,
    fraction: target > 0 ? Math.min(1, Math.max(0, current) / target) : 0,
  });
  switch (id) {
    case "first_game":
      return prog(stats.gamesPlayed, 1);
    case "globetrotter":
      return prog(stats.gamesPlayed, 25);
    case "geographer":
      return prog(stats.countryCorrect, 100);
    case "on_fire":
      return prog(streaks.win, 5);
    case "dedicated":
      return prog(streaks.daily, 7);
    case "veteran":
      return prog(stats.roundsPlayed, 500);
    default:
      return null;
  }
}

/** Return achievement ids satisfied by the context (not filtered by already-owned). */
export function evaluateAchievements(ctx: AchievementContext): string[] {
  return RULES.filter((r) => r.test(ctx)).map((r) => r.id);
}

/**
 * Given the ids already owned, return only newly unlocked ids.
 */
export function newlyUnlocked(
  ctx: AchievementContext,
  owned: readonly string[],
): string[] {
  const ownedSet = new Set(owned);
  return evaluateAchievements(ctx).filter((id) => !ownedSet.has(id));
}
