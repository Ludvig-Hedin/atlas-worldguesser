import type { GameModeId, GameSettings, Movement } from "./types";
import type { TKey } from "@/lib/i18n";

/** Official map metadata: scoring scale, region filter, and default map view. */
export interface MapConfig {
  id: GameModeId;
  slug: string;
  name: string;
  tagline: string;
  /** Scoring scale in km (larger = more forgiving). */
  scaleKm: number;
  /** Restrict locations to these ISO-3166 alpha-2 codes; null = worldwide. */
  countryCodes: string[] | null;
  /** Default guess-map view: [centerLng, centerLat, zoom]. */
  view: [number, number, number];
}

export const EUROPE_CODES = [
  "AL", "AD", "AT", "BE", "BA", "BG", "HR", "CZ", "DK", "EE", "FI", "FR", "DE",
  "GR", "HU", "IS", "IE", "IT", "LV", "LT", "LU", "MT", "MC", "ME", "NL", "MK",
  "NO", "PL", "PT", "RO", "RS", "SK", "SI", "ES", "SE", "CH", "GB", "UA",
];

// Continent code sets mirror EUROPE_CODES: an ISO alpha-2 filter over the shared
// seed dataset. Transcontinental countries (RU, TR, GE, AM, AZ, CY) are given a
// single home in Asia so every seed country belongs to exactly one continent map.
export const ASIA_CODES = [
  "AF", "AM", "AZ", "BH", "BD", "BT", "BN", "KH", "CN", "CY", "GE", "HK", "IN",
  "ID", "IR", "IQ", "IL", "JP", "JO", "KZ", "KW", "KG", "LA", "LB", "MY", "MV",
  "MN", "MM", "NP", "KP", "OM", "PK", "PS", "PH", "QA", "RU", "SA", "SG", "KR",
  "LK", "SY", "TW", "TJ", "TH", "TL", "TR", "TM", "AE", "UZ", "VN", "YE",
];

export const AFRICA_CODES = [
  "DZ", "AO", "BJ", "BW", "BF", "BI", "CM", "CV", "CF", "TD", "KM", "CD", "CG",
  "CI", "DJ", "EG", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN", "GW", "KE",
  "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE", "NG",
  "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG",
  "EH", "ZM", "ZW",
];

export const NORTH_AMERICA_CODES = [
  "US", "CA", "MX", "GT", "BZ", "SV", "HN", "NI", "CR", "PA", "CU", "DO", "HT",
  "JM", "BS", "BB", "TT", "AG", "DM", "GD", "KN", "LC", "VC", "PR",
];

export const SOUTH_AMERICA_CODES = [
  "AR", "BO", "BR", "CL", "CO", "EC", "FK", "GF", "GY", "PY", "PE", "SR", "UY",
  "VE",
];

export const OCEANIA_CODES = [
  "AU", "FJ", "KI", "MH", "FM", "NR", "NZ", "PW", "PG", "WS", "SB", "TO", "TV",
  "VU", "NC", "PF", "GU",
];

// Sub-region maps overlap the continent maps above — they are independent ISO
// filters over the same seed dataset, not a partition (a place can belong to
// both "asia" and "middleeast"). Only the continent set is mutually exclusive.
export const NORDIC_CODES = ["SE", "NO", "DK", "FI", "IS", "AX", "GL", "FO"];

export const MIDDLE_EAST_CODES = [
  "SA", "AE", "QA", "KW", "BH", "OM", "YE", "IR", "IQ", "IL", "PS", "JO",
  "LB", "SY", "TR", "CY",
];

export const SOUTHEAST_ASIA_CODES = [
  "ID", "TH", "VN", "MY", "PH", "SG", "KH", "LA", "MM", "BN", "TL",
];

export const MAPS: Record<GameModeId, MapConfig> = {
  world: {
    id: "world",
    slug: "world",
    name: "World",
    tagline: "Anywhere on Earth",
    scaleKm: 2000,
    countryCodes: null,
    view: [10, 25, 1.2],
  },
  europe: {
    id: "europe",
    slug: "europe",
    name: "Europe",
    tagline: "The whole continent",
    scaleKm: 800,
    countryCodes: EUROPE_CODES,
    view: [12, 52, 3.1],
  },
  nordics: {
    id: "nordics",
    slug: "nordics",
    name: "Nordics",
    tagline: "Scandinavia & the north",
    scaleKm: 500,
    countryCodes: NORDIC_CODES,
    view: [16, 63, 3.3],
  },
  asia: {
    id: "asia",
    slug: "asia",
    name: "Asia",
    tagline: "The largest continent",
    scaleKm: 1800,
    countryCodes: ASIA_CODES,
    view: [100, 30, 2.3],
  },
  middleeast: {
    id: "middleeast",
    slug: "middleeast",
    name: "Middle East",
    tagline: "Turkey to the Gulf",
    scaleKm: 1000,
    countryCodes: MIDDLE_EAST_CODES,
    view: [45, 29, 3.2],
  },
  southeastasia: {
    id: "southeastasia",
    slug: "southeastasia",
    name: "Southeast Asia",
    tagline: "Mekong to the islands",
    scaleKm: 900,
    countryCodes: SOUTHEAST_ASIA_CODES,
    view: [112, 8, 3.3],
  },
  africa: {
    id: "africa",
    slug: "africa",
    name: "Africa",
    tagline: "Cairo to Cape Town",
    scaleKm: 1800,
    countryCodes: AFRICA_CODES,
    view: [20, 3, 2.5],
  },
  northamerica: {
    id: "northamerica",
    slug: "northamerica",
    name: "North America",
    tagline: "Canada to Panama",
    scaleKm: 1500,
    countryCodes: NORTH_AMERICA_CODES,
    view: [-100, 40, 2.2],
  },
  southamerica: {
    id: "southamerica",
    slug: "southamerica",
    name: "South America",
    tagline: "The southern continent",
    scaleKm: 1400,
    countryCodes: SOUTH_AMERICA_CODES,
    view: [-60, -20, 2.6],
  },
  oceania: {
    id: "oceania",
    slug: "oceania",
    name: "Oceania",
    tagline: "Islands of the Pacific",
    scaleKm: 1600,
    countryCodes: OCEANIA_CODES,
    view: [150, -22, 2.3],
  },
  usa: {
    id: "usa",
    slug: "usa",
    name: "USA",
    tagline: "The fifty states",
    scaleKm: 700,
    countryCodes: ["US"],
    view: [-97, 39, 3.2],
  },
  countries: {
    id: "countries",
    slug: "countries",
    name: "Countries",
    tagline: "A famous place in every nation",
    scaleKm: 1500,
    countryCodes: null,
    view: [10, 25, 1.2],
  },
  custom: {
    id: "custom",
    slug: "custom",
    name: "Custom",
    tagline: "Your own set of places",
    scaleKm: 1500,
    countryCodes: null,
    view: [10, 25, 1.2],
  },
};

export const OFFICIAL_MAPS: MapConfig[] = [
  MAPS.world,
  MAPS.europe,
  MAPS.nordics,
  MAPS.asia,
  MAPS.middleeast,
  MAPS.southeastasia,
  MAPS.africa,
  MAPS.northamerica,
  MAPS.southamerica,
  MAPS.oceania,
  MAPS.usa,
  MAPS.countries,
];

export function getMapConfig(id: string): MapConfig {
  // Object.hasOwn so prototype members ("constructor", "toString", …) can't
  // masquerade as a map config and leak NaN into scoring via scaleKm.
  return Object.hasOwn(MAPS, id) ? (MAPS as Record<string, MapConfig>)[id] : MAPS.world;
}

/** Translation key for a map's display name — mirrors `MapConfig.name`, kept in sync in every locale file. */
export function mapNameKey(id: GameModeId): TKey {
  return `map.${id}.name` as TKey;
}

/** Translation key for a map's tagline — mirrors `MapConfig.tagline`, kept in sync in every locale file. */
export function mapTaglineKey(id: GameModeId): TKey {
  return `map.${id}.tagline` as TKey;
}

/** Translation key for a movement preset's short tag — mirrors `MOVEMENTS[].label`. */
export function movementLabelKey(id: Movement): TKey {
  return `movement.${id}.label` as TKey;
}

/** Translation key for a movement preset's plain-language name — mirrors `MOVEMENTS[].title`. */
export function movementTitleKey(id: Movement): TKey {
  return `movement.${id}.title` as TKey;
}

/** Translation key for a movement capability's label — mirrors `MOVEMENT_CAPS[].label`. */
export function movementCapLabelKey(key: "move" | "pan" | "zoom"): TKey {
  return `movementCap.${key}` as TKey;
}

export function scaleMetersForMap(id: string): number {
  return getMapConfig(id).scaleKm * 1000;
}

/**
 * Movement difficulty presets shown in the UI.
 * - `label`: short tag (kept for the in-game HUD and the read-only room badge).
 * - `title`: plain-language name shown in the "Rules" checklist.
 * - `caps`: what the player is actually allowed to do, mirroring the Street View
 *   gating in `google-street-view.tsx` (`optionsFor`). Drives the checklist.
 */
export const MOVEMENTS: {
  id: Movement;
  label: string;
  title: string;
  description: string;
  caps: { move: boolean; pan: boolean; zoom: boolean };
}[] = [
  {
    id: "moving",
    label: "Moving",
    title: "Move freely",
    description: "Walk the streets, look around, and zoom.",
    caps: { move: true, pan: true, zoom: true },
  },
  {
    id: "noMove",
    label: "No Move",
    title: "Stay put",
    description: "Look around and zoom, but you can't walk.",
    caps: { move: false, pan: true, zoom: true },
  },
  {
    id: "noMoveNoPanZoom",
    label: "NMPZ",
    title: "Frozen view",
    description: "One frozen frame — no moving, panning, or zooming.",
    caps: { move: false, pan: false, zoom: false },
  },
];

/** The three capabilities a movement preset can grant, in display order. */
export const MOVEMENT_CAPS = [
  { key: "move", label: "Move around" },
  { key: "pan", label: "Pan & look" },
  { key: "zoom", label: "Zoom in" },
] as const;

export const DEFAULT_SETTINGS: GameSettings = {
  rounds: 5,
  timeLimitSec: 0,
  movement: "moving",
};

export const ROUND_OPTIONS = [3, 5, 10] as const;
export const TIME_OPTIONS = [0, 30, 60, 120] as const;
