/**
 * Ranked rating — an "ELO-lite" informational number shown after every
 * competitive multiplayer match (FFA, Team, Duels) and on profiles/leaderboard.
 *
 * Deliberately NOT full chess-Elo: there is no matchmaking queue and no pairwise
 * per-opponent math. Each rated player is scored once against a single SYNTHETIC
 * average-opponent rating. For a 2-member room this formula degenerates exactly
 * into classical 2-player Elo with zero special-casing — so a future Duels mode
 * needs no Duels-specific rating code.
 *
 * Pure functions only (same convention as src/lib/xp.ts) so both the Convex
 * backend (convex/rooms.ts, convex/leaderboard.ts, convex/users.ts) and the UI
 * can share one source of truth.
 */

/** Starting rating for a player who has never played a rated match. */
export const DEFAULT_RATING = 1000;

export interface RatingTier {
  key: "bronze" | "silver" | "gold" | "platinum" | "diamond";
  label: string;
  /** Inclusive lower bound of the band. */
  min: number;
}

/**
 * Fixed 5-band ladder, ascending. Bands: Bronze <900, Silver 900–1099,
 * Gold 1100–1299, Platinum 1300–1499, Diamond 1500+. Kept intentionally coarse
 * (5 tiers, not GeoGuessr's 20+ sub-divisions) — enough to feel like progress
 * without demanding a matchmaking-grade ladder.
 */
export const RATING_TIERS: readonly RatingTier[] = [
  { key: "bronze", label: "Bronze", min: 0 },
  { key: "silver", label: "Silver", min: 900 },
  { key: "gold", label: "Gold", min: 1100 },
  { key: "platinum", label: "Platinum", min: 1300 },
  { key: "diamond", label: "Diamond", min: 1500 },
];

/** The tier a rating falls into (the highest band whose `min` it clears). */
export function tierForRating(rating: number): RatingTier {
  let tier = RATING_TIERS[0];
  for (const t of RATING_TIERS) {
    if (rating >= t.min) tier = t;
  }
  return tier;
}

export interface RatingDeltaInput {
  myRating: number;
  /** Synthetic average of all (non-guest) opponents' ratings. */
  avgOpponentRating: number;
  won: boolean;
  /** K-factor: larger = faster movement (placement period uses a bigger K). */
  k: number;
}

/**
 * Elo delta against a single synthetic average-opponent rating.
 *
 *   E     = 1 / (1 + 10^((avgOpponentRating - myRating) / 400))
 *   delta = round(k * ((won ? 1 : 0) - E))
 *
 * A player who beats stronger opponents (higher expected loss) gains more; a
 * player who loses to weaker opponents drops more. Symmetric around E = 0.5.
 */
export function computeRatingDelta({
  myRating,
  avgOpponentRating,
  won,
  k,
}: RatingDeltaInput): number {
  const expected = 1 / (1 + Math.pow(10, (avgOpponentRating - myRating) / 400));
  const actual = won ? 1 : 0;
  return Math.round(k * (actual - expected));
}

/** Placement period: the first few rated games move a rating faster. */
export const PLACEMENT_GAMES = 5;
const K_PLACEMENT = 60;
const K_SETTLED = 32;

/** K-factor for a player who has already played `ratingGamesPlayed` rated games. */
export function kFactorFor(ratingGamesPlayed: number): number {
  return ratingGamesPlayed < PLACEMENT_GAMES ? K_PLACEMENT : K_SETTLED;
}
