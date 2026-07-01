/**
 * Reproducible geo-data build.
 *
 * Downloads Natural Earth (public domain) sources and generates:
 *   - src/data/countries.geo.json  (trimmed country polygons: iso + name + geometry)
 *   - src/lib/countries-meta.ts     (iso -> display name + flag/name helpers)
 *   - src/data/locations.ts         (curated seed coordinates with country codes)
 *
 * Run with:  bun run build:geo   (or: node scripts/build-geo-data.mjs)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bpip from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, ".cache");
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(path.join(ROOT, "src/data"), { recursive: true });

const SOURCES = {
  countries:
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson",
  cities:
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_populated_places_simple.geojson",
};

async function fetchCached(name, url) {
  const file = path.join(CACHE, `${name}.geojson`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  process.stdout.write(`downloading ${name}… `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${name} failed: ${res.status}`);
  const text = await res.text();
  fs.writeFileSync(file, text);
  console.log("done");
  return JSON.parse(text);
}

const COMMON_NAMES = {
  US: "United States", GB: "United Kingdom", RU: "Russia", KR: "South Korea",
  KP: "North Korea", CD: "DR Congo", CG: "Congo", CZ: "Czechia", TZ: "Tanzania",
  VE: "Venezuela", BO: "Bolivia", IR: "Iran", SY: "Syria", LA: "Laos",
  VN: "Vietnam", BN: "Brunei", MD: "Moldova", MK: "North Macedonia", TW: "Taiwan",
};

function isoOf(props) {
  const a = props.ISO_A2_EH && props.ISO_A2_EH !== "-99" ? props.ISO_A2_EH : null;
  const b = props.ISO_A2 && props.ISO_A2 !== "-99" ? props.ISO_A2 : null;
  const name = props.NAME || props.ADMIN || "";
  const manual = { France: "FR", Norway: "NO", Kosovo: "XK", "N. Cyprus": "CY", Somaliland: "SO" };
  return (a || b || manual[name] || null)?.toUpperCase() ?? null;
}

async function main() {
  const [rawCountries, rawCities] = await Promise.all([
    fetchCached("countries", SOURCES.countries),
    fetchCached("cities", SOURCES.cities),
  ]);

  // 1) Trimmed polygons.
  const features = [];
  const names = {};
  for (const f of rawCountries.features) {
    const iso = isoOf(f.properties);
    if (!iso) continue;
    const name = f.properties.NAME || f.properties.ADMIN || iso;
    names[iso] = name;
    features.push({ type: "Feature", properties: { iso, name }, geometry: f.geometry });
  }
  const countriesFC = { type: "FeatureCollection", features };
  fs.writeFileSync(path.join(ROOT, "src/data/countries.geo.json"), JSON.stringify(countriesFC));
  console.log(`countries.geo.json: ${features.length} countries`);

  // 2) Names meta.
  Object.assign(names, COMMON_NAMES);
  const nameEntries = Object.keys(names)
    .sort()
    .map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(names[k])},`)
    .join("\n");
  const meta = `/** ISO 3166-1 alpha-2 -> display name. Generated from bundled Natural Earth data. */
export const COUNTRY_NAMES: Record<string, string> = {
${nameEntries}
};

/** Unicode flag emoji from a 2-letter ISO country code. */
export function flagEmoji(iso: string): string {
  const code = iso.trim().toUpperCase();
  if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) return "\u{1F3F3}\u{FE0F}";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + (code.charCodeAt(0) - 65), A + (code.charCodeAt(1) - 65));
}

/** Display name for a country code, falling back to the raw code. */
export function countryName(iso: string | null | undefined): string {
  if (!iso) return "Unknown";
  return COUNTRY_NAMES[iso.toUpperCase()] ?? iso.toUpperCase();
}
`;
  fs.writeFileSync(path.join(ROOT, "src/lib/countries-meta.ts"), meta);
  console.log(`countries-meta.ts: ${Object.keys(names).length} names`);

  // 3) Seed locations, country resolved via the same polygons used for scoring.
  const countryAt = (lng, lat) => {
    const p = point([lng, lat]);
    for (const f of countriesFC.features) {
      try {
        if (bpip(p, f)) return f.properties.iso;
      } catch {}
    }
    return null;
  };

  const raw = [];
  for (const f of rawCities.features) {
    const p = f.properties;
    const [lng, lat] = f.geometry.coordinates;
    const pop = p.pop_max || 0;
    const isCapital = p.featurecla && /capital/i.test(p.featurecla);
    if (pop < 150000 && !isCapital) continue;
    const cc = countryAt(lng, lat) || (p.iso_a2 && p.iso_a2 !== "-99" ? p.iso_a2 : null);
    if (!cc) continue;
    raw.push({ lat: +lat.toFixed(5), lng: +lng.toFixed(5), cc: cc.toUpperCase(), name: p.name, pop });
  }
  raw.sort((a, b) => b.pop - a.pop);

  const PER_COUNTRY = 9;
  const perCC = new Map();
  const world = [];
  for (const c of raw) {
    const n = perCC.get(c.cc) || 0;
    if (n >= PER_COUNTRY) continue;
    perCC.set(c.cc, n + 1);
    world.push({ lat: c.lat, lng: c.lng, cc: c.cc, name: c.name });
  }
  const seen = new Set();
  const byCountry = [];
  for (const c of raw) {
    if (seen.has(c.cc)) continue;
    seen.add(c.cc);
    byCountry.push({ lat: c.lat, lng: c.lng, cc: c.cc, name: c.name });
  }

  const serialize = (name, arr) =>
    `export const ${name}: SeedLocation[] = [\n${arr
      .map((c) => `  { lat: ${c.lat}, lng: ${c.lng}, cc: ${JSON.stringify(c.cc)}, name: ${JSON.stringify(c.name)} },`)
      .join("\n")}\n];\n`;

  const locations = `/**
 * Curated seed of real-world coordinates with country codes.
 * Source: Natural Earth populated places (public domain); each point's country
 * resolved against the same polygons used for scoring. Generated — do not edit by hand.
 */
import type { GameLocation } from "@/lib/types";

export interface SeedLocation {
  lat: number;
  lng: number;
  /** ISO 3166-1 alpha-2. */
  cc: string;
  /** City name — internal/debug only, never shown before a guess. */
  name: string;
}

export function toGameLocation(s: SeedLocation): GameLocation {
  return { lat: s.lat, lng: s.lng, countryCode: s.cc };
}

${serialize("WORLD_LOCATIONS", world)}
${serialize("COUNTRY_LOCATIONS", byCountry)}`;
  fs.writeFileSync(path.join(ROOT, "src/data/locations.ts"), locations);
  console.log(`locations.ts: world=${world.length}, countries=${byCountry.length}, distinct=${perCC.size}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
