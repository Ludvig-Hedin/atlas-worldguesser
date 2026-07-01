import type { GameLocation } from "./types";
import { hashString } from "./utils";

/**
 * Deterministic procedural scene for the keyless demo panorama.
 * Palette is tinted by latitude (climate band) so the demo has *some* signal
 * without revealing the location. Pure + deterministic for stable rendering.
 */

export type ClimateBand = "polar" | "temperate" | "arid" | "tropical";

export function climateBand(lat: number): ClimateBand {
  const a = Math.abs(lat);
  if (a >= 60) return "polar";
  if (a >= 35) return "temperate";
  if (a >= 23.5) return "arid";
  return "tropical";
}

export interface DemoScene {
  band: ClimateBand;
  skyTop: string;
  skyBottom: string;
  ground: string;
  horizon: string;
  hue: number;
}

const BANDS: Record<ClimateBand, Omit<DemoScene, "band" | "hue">> = {
  polar: { skyTop: "#1b2b3a", skyBottom: "#6b8ba3", ground: "#d6e2ea", horizon: "#9fb4c4" },
  temperate: { skyTop: "#20304a", skyBottom: "#6d8fb8", ground: "#3f5a3a", horizon: "#5b7a5a" },
  arid: { skyTop: "#3a3352", skyBottom: "#caa46a", ground: "#8a6b3f", horizon: "#b1894f" },
  tropical: { skyTop: "#16324a", skyBottom: "#4fa3b8", ground: "#2f6b4a", horizon: "#3f8a63" },
};

/** Build a deterministic scene descriptor for a location. */
export function demoScene(location: GameLocation): DemoScene {
  const band = climateBand(location.lat);
  const base = BANDS[band];
  const hue = hashString(`${location.lat.toFixed(3)},${location.lng.toFixed(3)}`) % 360;
  return { band, hue, ...base };
}
