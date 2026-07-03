import type { RoundResult } from "./types";

/** A curated iconic-building avatar, keyed by ISO 3166-1 alpha-2 country code. */
export interface BuildingDef {
  /** Country code, e.g. "FR". Doubles as the unlock key. */
  id: string;
  /** Building/landmark display name, e.g. "Eiffel Tower". */
  name: string;
  /** Static asset path, e.g. "/buildings/fr.png". */
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
  { id: "FR", name: "Eiffel Tower", image: "/buildings/fr.png" },
  { id: "IT", name: "Colosseum", image: "/buildings/it.png" },
  { id: "IN", name: "Taj Mahal", image: "/buildings/in.png" },
  { id: "GB", name: "Big Ben", image: "/buildings/gb.png" },
  { id: "US", name: "Statue of Liberty", image: "/buildings/us.png" },
  { id: "EG", name: "Pyramids of Giza", image: "/buildings/eg.png" },
  { id: "CN", name: "Great Wall of China", image: "/buildings/cn.png" },
  { id: "AU", name: "Sydney Opera House", image: "/buildings/au.png" },
  { id: "BR", name: "Christ the Redeemer", image: "/buildings/br.png" },
  { id: "RU", name: "Saint Basil's Cathedral", image: "/buildings/ru.png" },
  { id: "DE", name: "Neuschwanstein Castle", image: "/buildings/de.png" },
  { id: "ES", name: "Sagrada Família", image: "/buildings/es.png" },
  { id: "JP", name: "Tokyo Tower", image: "/buildings/jp.png" },
  { id: "GR", name: "Parthenon", image: "/buildings/gr.png" },
  { id: "PE", name: "Machu Picchu", image: "/buildings/pe.png" },
  { id: "MX", name: "Chichén Itzá", image: "/buildings/mx.png" },
  { id: "TR", name: "Hagia Sophia", image: "/buildings/tr.png" },
  { id: "AE", name: "Burj Khalifa", image: "/buildings/ae.png" },
  { id: "KH", name: "Angkor Wat", image: "/buildings/kh.png" },
  { id: "JO", name: "Petra", image: "/buildings/jo.png" },
  { id: "CA", name: "CN Tower", image: "/buildings/ca.png" },
  { id: "PT", name: "Belém Tower", image: "/buildings/pt.png" },
  { id: "CZ", name: "Prague Castle", image: "/buildings/cz.png" },
  { id: "AT", name: "Schönbrunn Palace", image: "/buildings/at.png" },
  { id: "MA", name: "Hassan II Mosque", image: "/buildings/ma.png" },
  { id: "ID", name: "Borobudur", image: "/buildings/id.png" },
  { id: "KR", name: "Gyeongbokgung Palace", image: "/buildings/kr.png" },
  { id: "TH", name: "Grand Palace", image: "/buildings/th.png" },
  { id: "PL", name: "Wawel Castle", image: "/buildings/pl.png" },
  { id: "HU", name: "Hungarian Parliament Building", image: "/buildings/hu.png" },
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
