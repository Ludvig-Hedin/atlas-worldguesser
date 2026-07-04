import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { locationKey, mergeRecentKeys } from "./gameLogic";

/**
 * The set of location keys (see `locationKey`) `userId` was recently shown on
 * `mapId`, across solo games and any room they hosted or played in. Empty
 * when the user has no history yet for this map.
 */
export async function getRecentLocationKeys(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  mapId: string,
): Promise<Set<string>> {
  // `.first()` (not `.unique()`): mirrors the defensive read pattern already
  // used for guest rows (see users.currentUser) — a rare double-insert race
  // must degrade to the earliest row, not throw and break the game.
  const row = await ctx.db
    .query("recentLocations")
    .withIndex("by_user_map", (q) => q.eq("userId", userId).eq("mapId", mapId))
    .first();
  return new Set(row?.keys ?? []);
}

/**
 * Record that `userId` was just shown `locations` on `mapId`, so future picks
 * (see gameLogic.pickMatchLocations) bias away from repeating them.
 */
export async function recordSeenLocations(
  ctx: MutationCtx,
  userId: Id<"users">,
  mapId: string,
  locations: readonly { lat: number; lng: number }[],
): Promise<void> {
  if (locations.length === 0) return;
  const row = await ctx.db
    .query("recentLocations")
    .withIndex("by_user_map", (q) => q.eq("userId", userId).eq("mapId", mapId))
    .first();
  const keys = mergeRecentKeys(row?.keys ?? [], locations.map(locationKey));
  if (row) {
    await ctx.db.patch(row._id, { keys, updatedAt: Date.now() });
  } else {
    await ctx.db.insert("recentLocations", { userId, mapId, keys, updatedAt: Date.now() });
  }
}
