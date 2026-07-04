import { WORLD_LOCATIONS, COUNTRY_LOCATIONS, toGameLocation, type SeedLocation } from "@/data/locations";
import { getMapConfig } from "./maps-config";
import type { GameLocation } from "./types";
import { layeredSample, locationKey } from "@convex/gameLogic";

/**
 * The candidate pool of seed locations for a given map. Driven entirely off the
 * map's `countryCodes` filter (null = worldwide), so any region/continent/single
 * country map is a config addition in `maps-config.ts` — no change needed here.
 * `countries` is the one true special case (its own one-place-per-nation pool).
 */
export function getMapPool(mapId: string): SeedLocation[] {
  if (mapId === "countries") return COUNTRY_LOCATIONS;
  const codes = getMapConfig(mapId).countryCodes;
  if (!codes) return WORLD_LOCATIONS;
  const set = new Set(codes);
  return WORLD_LOCATIONS.filter((l) => set.has(l.cc));
}

export function poolSize(mapId: string): number {
  return getMapPool(mapId).length;
}

/**
 * Sample `count` locations from a pool. When `excludeKeys` is given, items not
 * in it are used first, so callers can dedup against a player's recent
 * history; either way, falls back to repeats only once the whole pool has
 * been used once. Uses an injectable RNG for deterministic replays.
 */
export function sampleLocations(
  pool: readonly GameLocation[],
  count: number,
  rng: () => number = Math.random,
  excludeKeys?: ReadonlySet<string>,
): GameLocation[] {
  return layeredSample(pool, count, rng, locationKey, excludeKeys);
}

/**
 * Pick `count` locations for an official map's round set.
 */
export function pickLocations(
  mapId: string,
  count: number,
  rng: () => number = Math.random,
  excludeKeys?: ReadonlySet<string>,
): GameLocation[] {
  const pool = getMapPool(mapId).map(toGameLocation);
  return sampleLocations(pool, count, rng, excludeKeys);
}
