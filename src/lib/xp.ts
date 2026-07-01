import type { RoundResult } from "./types";

/**
 * Progression curve.
 * XP per round is a fifth of the round score (perfect round = 1000 XP),
 * with a small bonus for pinpoint guesses. Levels follow a quadratic curve
 * so early levels come quickly and later ones require sustained play.
 */

const A = 200; // quadratic coefficient
const B = 1000; // linear coefficient

/** XP earned from a single round result. */
export function xpForRound(result: Pick<RoundResult, "score" | "distanceMeters">): number {
  const base = Math.round(result.score / 5);
  const pinpointBonus = result.distanceMeters < 1000 ? 100 : 0;
  return base + pinpointBonus;
}

/** XP earned from a full set of round results. */
export function xpForGame(results: readonly Pick<RoundResult, "score" | "distanceMeters">[]): number {
  return results.reduce((sum, r) => sum + xpForRound(r), 0);
}

/** Total cumulative XP required to have reached a given level (level 1 = 0). */
export function totalXpForLevel(level: number): number {
  const l = Math.max(1, Math.floor(level)) - 1;
  return A * l * l + B * l;
}

/** The player's level for a given total XP. */
export function levelForXp(xp: number): number {
  const safe = Math.max(0, xp);
  const l = Math.floor((-B + Math.sqrt(B * B + 4 * A * safe)) / (2 * A));
  return Math.max(1, l + 1);
}

export interface LevelProgress {
  level: number;
  /** XP accumulated inside the current level. */
  into: number;
  /** XP span of the current level. */
  span: number;
  /** 0–1 fraction toward the next level. */
  fraction: number;
  xpToNext: number;
}

/** Detailed progress within the current level. */
export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const floor = totalXpForLevel(level);
  const ceil = totalXpForLevel(level + 1);
  const span = Math.max(1, ceil - floor);
  const into = Math.max(0, xp - floor);
  return {
    level,
    into,
    span,
    fraction: Math.min(1, into / span),
    xpToNext: Math.max(0, ceil - xp),
  };
}
