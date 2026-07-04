import type { TKey } from "@/lib/i18n";
import {
  AFRICA_CODES,
  ASIA_CODES,
  EUROPE_CODES,
  NORTH_AMERICA_CODES,
  OCEANIA_CODES,
  SOUTH_AMERICA_CODES,
} from "@/lib/maps-config";

/** Region a Flags game can be scoped to. */
export type FlagRegionId = "world" | "europe" | "asia" | "africa" | "americas" | "oceania";

/** Stimulus shown for each round: the flag image, or the country's name. */
export type FlagGameMode = "flag" | "name";

export interface FlagRegion {
  id: FlagRegionId;
  /** ISO alpha-2 filter over the country polygons; null = worldwide. */
  codes: string[] | null;
  /** Default map view: [centerLng, centerLat, zoom]. */
  view: [number, number, number];
  /** Translation key for the display name. */
  nameKey: TKey;
}

/**
 * The six scopes shown in the Flags setup. Region ISO lists are reused from
 * `maps-config` (the same continent filters the street-view maps use); the pool
 * builder later intersects them with the countries that actually have a polygon
 * and a flag SVG, so codes without geometry (Malta, Singapore, most Pacific
 * micro-states) are simply never asked. Names reuse the existing `map.*.name`
 * keys except "Americas", which is a Flags-only combination of both American
 * continents.
 */
export const FLAG_REGIONS: FlagRegion[] = [
  { id: "world", codes: null, view: [10, 25, 1.2], nameKey: "map.world.name" },
  { id: "europe", codes: EUROPE_CODES, view: [12, 52, 3.1], nameKey: "map.europe.name" },
  { id: "asia", codes: ASIA_CODES, view: [100, 30, 2.3], nameKey: "map.asia.name" },
  { id: "africa", codes: AFRICA_CODES, view: [20, 3, 2.5], nameKey: "map.africa.name" },
  {
    id: "americas",
    codes: [...NORTH_AMERICA_CODES, ...SOUTH_AMERICA_CODES],
    view: [-80, -3, 1.6],
    nameKey: "flagRegion.americas.name",
  },
  { id: "oceania", codes: OCEANIA_CODES, view: [150, -22, 2.3], nameKey: "map.oceania.name" },
];

/** Ordered valid region ids (also used to validate deep-link/query params). */
export const FLAG_REGION_IDS: FlagRegionId[] = FLAG_REGIONS.map((r) => r.id);

/** Resolve a region config, defaulting to World for anything unknown. */
export function getFlagRegion(id: string): FlagRegion {
  return FLAG_REGIONS.find((r) => r.id === id) ?? FLAG_REGIONS[0];
}

export function isFlagRegionId(id: string): id is FlagRegionId {
  return FLAG_REGION_IDS.includes(id as FlagRegionId);
}
