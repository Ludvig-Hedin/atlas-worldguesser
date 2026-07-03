/**
 * Shared SEO constants and helpers.
 *
 * Single source of truth for the canonical site URL, brand strings, and the
 * target keyword set we optimize for ("map game", "guess the location",
 * "geoguessr alternative", "geography guessing game", "street view game", …).
 *
 * Use `canonical(path)` to set a per-page canonical URL and `NOINDEX` to keep
 * private/dynamic app routes out of the index.
 */
import type { Metadata } from "next";

export const SITE_URL = "https://geoatlas.xyz";
export const SITE_NAME = "Atlas";
export const TWITTER_HANDLE = "@geoatlas";

/** Primary target keywords. Woven into copy — kept here for metadata + reuse. */
export const SITE_KEYWORDS = [
  "map game",
  "guess the location",
  "geoguesser",
  "geoguessr alternative",
  "geography guessing game",
  "street view game",
  "guess the country game",
  "map guessing game",
  "where in the world game",
  "free geography game",
  "online map game",
  "guess where you are",
] as const;

/** Absolute URL from an app-relative path. `/` → SITE_URL. */
export function absoluteUrl(path = "/"): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

/** Per-page canonical helper: `...canonical("/leaderboard")`. */
export function canonical(path: string): Metadata {
  return { alternates: { canonical: path } };
}

/** Keep private/dynamic routes out of search while still following internal links. */
export const NOINDEX: Metadata["robots"] = {
  index: false,
  follow: true,
};
