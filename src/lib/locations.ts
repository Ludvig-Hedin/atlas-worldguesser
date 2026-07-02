import { WORLD_LOCATIONS, COUNTRY_LOCATIONS, toGameLocation, type SeedLocation } from "@/data/locations";
import { EUROPE_CODES } from "./maps-config";
import type { GameLocation, GameModeId } from "./types";
import { sample } from "./utils";

const EUROPE_SET = new Set(EUROPE_CODES);

/** The candidate pool of seed locations for a given map. */
export function getMapPool(mapId: string): SeedLocation[] {
  switch (mapId as GameModeId) {
    case "europe":
      return WORLD_LOCATIONS.filter((l) => EUROPE_SET.has(l.cc));
    case "usa":
      return WORLD_LOCATIONS.filter((l) => l.cc === "US");
    case "countries":
      return COUNTRY_LOCATIONS;
    case "world":
    case "custom":
    default:
      return WORLD_LOCATIONS;
  }
}

export function poolSize(mapId: string): number {
  return getMapPool(mapId).length;
}

/**
 * Sample `count` locations from a pool, allowing repeats only if the pool is
 * smaller than requested. Uses an injectable RNG for deterministic replays.
 */
export function sampleLocations(
  pool: readonly GameLocation[],
  count: number,
  rng: () => number = Math.random,
): GameLocation[] {
  const chosen = sample(pool, count, rng);
  while (chosen.length < count && pool.length > 0) {
    chosen.push(pool[Math.floor(rng() * pool.length)]);
  }
  return chosen;
}

/**
 * Pick `count` locations for an official map's round set.
 */
export function pickLocations(
  mapId: string,
  count: number,
  rng: () => number = Math.random,
): GameLocation[] {
  const pool = getMapPool(mapId).map(toGameLocation);
  return sampleLocations(pool, count, rng);
}
