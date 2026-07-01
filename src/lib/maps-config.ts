import type { GameModeId, GameSettings, Movement } from "./types";

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
  emoji: string;
}

export const EUROPE_CODES = [
  "AL", "AD", "AT", "BE", "BA", "BG", "HR", "CZ", "DK", "EE", "FI", "FR", "DE",
  "GR", "HU", "IS", "IE", "IT", "LV", "LT", "LU", "MT", "MC", "ME", "NL", "MK",
  "NO", "PL", "PT", "RO", "RS", "SK", "SI", "ES", "SE", "CH", "GB", "UA",
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
    emoji: "🌍",
  },
  europe: {
    id: "europe",
    slug: "europe",
    name: "Europe",
    tagline: "The whole continent",
    scaleKm: 800,
    countryCodes: EUROPE_CODES,
    view: [12, 52, 3.1],
    emoji: "🇪🇺",
  },
  usa: {
    id: "usa",
    slug: "usa",
    name: "USA",
    tagline: "The fifty states",
    scaleKm: 700,
    countryCodes: ["US"],
    view: [-97, 39, 3.2],
    emoji: "🗽",
  },
  countries: {
    id: "countries",
    slug: "countries",
    name: "Countries",
    tagline: "A famous place in every nation",
    scaleKm: 1500,
    countryCodes: null,
    view: [10, 25, 1.2],
    emoji: "🚩",
  },
  custom: {
    id: "custom",
    slug: "custom",
    name: "Custom",
    tagline: "Your own set of places",
    scaleKm: 1500,
    countryCodes: null,
    view: [10, 25, 1.2],
    emoji: "✨",
  },
};

export const OFFICIAL_MAPS: MapConfig[] = [
  MAPS.world,
  MAPS.europe,
  MAPS.usa,
  MAPS.countries,
];

export function getMapConfig(id: string): MapConfig {
  return (MAPS as Record<string, MapConfig>)[id] ?? MAPS.world;
}

export function scaleMetersForMap(id: string): number {
  return getMapConfig(id).scaleKm * 1000;
}

/** Movement difficulty presets shown in the UI. */
export const MOVEMENTS: { id: Movement; label: string; description: string }[] = [
  { id: "moving", label: "Moving", description: "Walk, pan, and zoom freely" },
  { id: "noMove", label: "No Move", description: "Look around, but stay put" },
  {
    id: "noMoveNoPanZoom",
    label: "NMPZ",
    description: "No move, pan, or zoom — pure instinct",
  },
];

export const DEFAULT_SETTINGS: GameSettings = {
  rounds: 5,
  timeLimitSec: 0,
  movement: "moving",
};

export const ROUND_OPTIONS = [3, 5, 10] as const;
export const TIME_OPTIONS = [0, 30, 60, 120] as const;
