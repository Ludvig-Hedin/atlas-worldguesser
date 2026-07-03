import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import type { LatLng } from "./types";

type CountryFeature = Feature<Polygon | MultiPolygon, { iso: string; name: string }>;
interface CountriesFC {
  type: "FeatureCollection";
  features: CountryFeature[];
}

let cache: CountriesFC | null = null;

/** Lazily load the bundled country polygons (kept out of the initial bundle). */
export async function loadCountries(): Promise<CountriesFC> {
  if (cache) return cache;
  const mod = await import("@/data/countries.geo.json");
  cache = (mod.default ?? mod) as unknown as CountriesFC;
  return cache;
}

/** Synchronous point-in-country against an already-loaded collection. */
export function countryAt(pt: LatLng, fc: CountriesFC): string | null {
  const p = point([pt.lng, pt.lat]);
  for (const feature of fc.features) {
    try {
      if (booleanPointInPolygon(p, feature)) return feature.properties.iso;
    } catch {
      // Skip malformed geometry rather than fail the whole lookup.
    }
  }
  return null;
}

/** Resolve the ISO alpha-2 country code containing a point, or null (e.g. ocean). */
export async function countryAtAsync(pt: LatLng): Promise<string | null> {
  const fc = await loadCountries();
  return countryAt(pt, fc);
}

/** A geodesic circle polygon (GeoJSON) around a center — used for the map hint. */
export function circlePolygon(
  center: LatLng,
  radiusMeters: number,
  steps = 72,
): Feature<Polygon> {
  const R = 6_371_008.8;
  const lat = (center.lat * Math.PI) / 180;
  const lng = (center.lng * Math.PI) / 180;
  const d = radiusMeters / R;
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const brng = (i / steps) * 2 * Math.PI;
    const lat2 = Math.asin(Math.sin(lat) * Math.cos(d) + Math.cos(lat) * Math.sin(d) * Math.cos(brng));
    const lng2 =
      lng + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat), Math.cos(d) - Math.sin(lat) * Math.sin(lat2));
    coords.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coords] } };
}

/** Rough continent for a coordinate — good enough for an in-game hint. */
// TODO(bug-hunt): known misclassifications shown to players as a paid hint —
// coastal North Africa above 35°N (Tunis, Algiers, Tangier) reads "Europe",
// and Central America below 13°N (Panama City, San José) reads "South
// America". Both call sites already know the actual countryCode, so a
// country-code → continent lookup would be exact; a pure lat/lng heuristic
// can't split these bands without breaking southern Spain/Greece or Colombia.
export function continentOf(lat: number, lng: number): string {
  if (lat <= -60) return "Antarctica";
  if (lng >= 112 && lat <= 0) return "Oceania";
  if (lat >= 35 && lng >= -25 && lng <= 40) return "Europe";
  if (lng >= 45 && lat >= 5) return "Asia";
  if (lat >= -37 && lng >= -20 && lng <= 52) return "Africa";
  if (lng <= -30) return lat >= 13 ? "North America" : "South America";
  return "Asia";
}
