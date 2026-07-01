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
 * Pick `count` unique locations for a round set, using an injectable RNG so
 * daily challenges and replays can be reproduced from a seed.
 */
export function pickLocations(
  mapId: string,
  count: number,
  rng: () => number = Math.random,
): GameLocation[] {
  const pool = getMapPool(mapId);
  const chosen = sample(pool, count, rng);
  // If the pool is smaller than requested (tiny custom maps), allow repeats.
  while (chosen.length < count && pool.length > 0) {
    chosen.push(pool[Math.floor(rng() * pool.length)]);
  }
  return chosen.map(toGameLocation);
}
