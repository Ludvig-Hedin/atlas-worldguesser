import type { RoundResult } from "./types";

/** A curated iconic-building avatar, keyed by ISO 3166-1 alpha-2 country code. */
export interface BuildingDef {
  /** Country code, e.g. "FR". Doubles as the unlock key. */
  id: string;
  /** Building/landmark display name, e.g. "Eiffel Tower". */
  name: string;
  /** Static asset path, e.g. "/buildings/fr.svg". */
  image: string;
}

/**
 * Curated launch set of ~30 countries with an iconic-building avatar.
 * Every code below is confirmed present in src/data/locations.ts, so a
 * correct guess for it is actually reachable in-game. Countries not in this
 * list simply have no unlockable building yet (players keep the default
 * gradient/initials avatar) — safe to extend this list over time.
 */
const RULES: BuildingDef[] = [
  { id: "FR", name: "Eiffel Tower", image: "/buildings/fr.svg" },
  { id: "IT", name: "Colosseum", image: "/buildings/it.svg" },
  { id: "IN", name: "Taj Mahal", image: "/buildings/in.svg" },
  { id: "GB", name: "Big Ben", image: "/buildings/gb.svg" },
  { id: "US", name: "Statue of Liberty", image: "/buildings/us.svg" },
  { id: "EG", name: "Pyramids of Giza", image: "/buildings/eg.svg" },
  { id: "CN", name: "Great Wall of China", image: "/buildings/cn.svg" },
  { id: "AU", name: "Sydney Opera House", image: "/buildings/au.svg" },
  { id: "BR", name: "Christ the Redeemer", image: "/buildings/br.svg" },
  { id: "RU", name: "Saint Basil's Cathedral", image: "/buildings/ru.svg" },
  { id: "DE", name: "Neuschwanstein Castle", image: "/buildings/de.svg" },
  { id: "ES", name: "Sagrada Família", image: "/buildings/es.svg" },
  { id: "JP", name: "Tokyo Tower", image: "/buildings/jp.svg" },
  { id: "GR", name: "Parthenon", image: "/buildings/gr.svg" },
  { id: "PE", name: "Machu Picchu", image: "/buildings/pe.svg" },
  { id: "MX", name: "Chichén Itzá", image: "/buildings/mx.svg" },
  { id: "TR", name: "Hagia Sophia", image: "/buildings/tr.svg" },
  { id: "AE", name: "Burj Khalifa", image: "/buildings/ae.svg" },
  { id: "KH", name: "Angkor Wat", image: "/buildings/kh.svg" },
  { id: "JO", name: "Petra", image: "/buildings/jo.svg" },
  { id: "CA", name: "CN Tower", image: "/buildings/ca.svg" },
  { id: "PT", name: "Belém Tower", image: "/buildings/pt.svg" },
  { id: "CZ", name: "Prague Castle", image: "/buildings/cz.svg" },
  { id: "AT", name: "Schönbrunn Palace", image: "/buildings/at.svg" },
  { id: "MA", name: "Hassan II Mosque", image: "/buildings/ma.svg" },
  { id: "ID", name: "Borobudur", image: "/buildings/id.svg" },
  { id: "KR", name: "Gyeongbokgung Palace", image: "/buildings/kr.svg" },
  { id: "TH", name: "Grand Palace", image: "/buildings/th.svg" },
  { id: "PL", name: "Wawel Castle", image: "/buildings/pl.svg" },
  { id: "HU", name: "Hungarian Parliament Building", image: "/buildings/hu.svg" },
];

export const BUILDINGS: Record<string, BuildingDef> = Object.fromEntries(
  RULES.map((b) => [b.id, b]),
);

export const BUILDING_LIST: BuildingDef[] = RULES;

/** Curated accent-color swatches for the avatar background chip. Not gated by unlocks. */
export const AVATAR_COLORS: string[] = [
  "#64748b", // slate
  "#b45309", // amber
  "#15803d", // green
  "#0e7490", // cyan
  "#4338ca", // indigo
  "#a21caf", // fuchsia
  "#b91c1c", // red
  "#334155", // slate-dark
];

export const DEFAULT_AVATAR_COLOR = AVATAR_COLORS[0];

/** Country codes (from this game's results) that have a curated building AND were guessed correctly. */
export function evaluateBuildingUnlocks(results: readonly RoundResult[]): string[] {
  const hit = new Set<string>();
  for (const r of results) {
    if (r.countryCorrect && BUILDINGS[r.actual.countryCode]) {
      hit.add(r.actual.countryCode);
    }
  }
  return [...hit];
}

/** Given the building ids already owned, return only the newly unlocked ones from this game. */
export function newlyUnlockedBuildings(
  results: readonly RoundResult[],
  owned: readonly string[],
): string[] {
  const ownedSet = new Set(owned);
  return evaluateBuildingUnlocks(results).filter((id) => !ownedSet.has(id));
}
