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
