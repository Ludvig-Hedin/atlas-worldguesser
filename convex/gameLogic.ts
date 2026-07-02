/**
 * Server-side game logic for multiplayer. Reuses the pure scoring core from the
 * app (`src/lib/scoring`, `src/lib/maps-config`) and the shared seed dataset so
 * solo and multiplayer stay perfectly consistent.
 */
import { haversineMeters, roundScore } from "../src/lib/scoring";
import { EUROPE_CODES, scaleMetersForMap } from "../src/lib/maps-config";
import { WORLD_LOCATIONS, COUNTRY_LOCATIONS, type SeedLocation } from "../src/data/locations";

export { scaleMetersForMap, haversineMeters, roundScore };

export const ANTIPODE_METERS = Math.PI * 6_371_008.8;

export interface MatchLocation {
  lat: number;
  lng: number;
  countryCode: string;
}

const EUROPE_SET = new Set(EUROPE_CODES);

function pool(mapId: string): SeedLocation[] {
  switch (mapId) {
    case "europe":
      return WORLD_LOCATIONS.filter((l) => EUROPE_SET.has(l.cc));
    case "usa":
      return WORLD_LOCATIONS.filter((l) => l.cc === "US");
    case "countries":
      return COUNTRY_LOCATIONS;
    default:
      return WORLD_LOCATIONS;
  }
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministically pick the match's hidden answer locations from a seed. */
export function pickMatchLocations(mapId: string, rounds: number, seed: number): MatchLocation[] {
  const p = pool(mapId).slice();
  const rng = mulberry32(seed);
  for (let i = p.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const chosen = p.slice(0, Math.min(rounds, p.length));
  while (chosen.length < rounds && p.length > 0) {
    chosen.push(p[Math.floor(rng() * p.length)]);
  }
  return chosen.map((s) => ({ lat: s.lat, lng: s.lng, countryCode: s.cc }));
}

/** Authoritative distance + score for a guess (score computed server-side). */
export function computeGuessScore(
  guess: { lat: number; lng: number } | null,
  actual: { lat: number; lng: number },
  mapId: string,
): { distanceMeters: number; score: number } {
  if (!guess) return { distanceMeters: ANTIPODE_METERS, score: 0 };
  const distanceMeters = haversineMeters(guess, actual);
  return { distanceMeters, score: roundScore(distanceMeters, scaleMetersForMap(mapId)) };
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A short, unambiguous room code. */
export function randomRoomCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return s;
}
