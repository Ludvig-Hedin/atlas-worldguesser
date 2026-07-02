/// <reference types="google.maps" />
import { googleMapsBrowserKey, googleMapsDisabled } from "./env";

let loadPromise: Promise<typeof google> | null = null;

const SCRIPT_TIMEOUT_MS = 15_000;
const PANO_TIMEOUT_MS = 10_000;

/**
 * Load the Google Maps JS API exactly once. Resolves with the `google` global.
 * Rejects (so the caller falls back to demo mode) if no key is configured, the
 * kill switch is set, or the script fails/times out. Never retries in a loop.
 */
export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }
  if (googleMapsDisabled) {
    return Promise.reject(new Error("Google Maps disabled by kill switch"));
  }
  if (!googleMapsBrowserKey) {
    return Promise.reject(new Error("No Google Maps browser key configured"));
  }
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<typeof google>((resolve, reject) => {
    const callbackName = "__atlasGmapsReady";
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      loadPromise = null;
      reject(new Error("Google Maps load timed out"));
    }, SCRIPT_TIMEOUT_MS);

    (window as unknown as Record<string, unknown>)[callbackName] = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(window.google);
    };
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: googleMapsBrowserKey,
      v: "weekly",
      loading: "async",
      callback: callbackName,
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      loadPromise = null;
      reject(new Error("Failed to load Google Maps JS API"));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}

export interface PanoResolution {
  panoId: string;
  location: google.maps.LatLng;
  heading: number;
}

// Cache resolved panoramas and de-duplicate concurrent lookups so the billed
// Street View Metadata API is hit at most once per distinct coordinate.
const panoCache = new Map<string, PanoResolution | null>();
const inFlight = new Map<string, Promise<PanoResolution | null>>();
const PANO_CACHE_MAX = 500;

function panoKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function resolvePano(
  svService: google.maps.StreetViewService,
  lat: number,
  lng: number,
  radius: number,
): Promise<PanoResolution | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: PanoResolution | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    // Single attempt, hard timeout — never a retry loop.
    const timeout = setTimeout(() => done(null), PANO_TIMEOUT_MS);
    svService.getPanorama(
      {
        location: { lat, lng },
        radius,
        preference: google.maps.StreetViewPreference.NEAREST,
        source: google.maps.StreetViewSource.OUTDOOR,
      },
      (data, status) => {
        clearTimeout(timeout);
        if (
          status === google.maps.StreetViewStatus.OK &&
          data?.location?.pano &&
          data.location.latLng
        ) {
          const heading = data.tiles?.centerHeading ?? 0;
          done({ panoId: data.location.pano, location: data.location.latLng, heading });
        } else {
          done(null);
        }
      },
    );
  });
}

/**
 * Find the nearest official Street View panorama to a coordinate. Cached and
 * de-duplicated: repeat/concurrent lookups for the same point never bill twice.
 */
export function findPanorama(
  svService: google.maps.StreetViewService,
  lat: number,
  lng: number,
  radius = 50_000,
): Promise<PanoResolution | null> {
  const key = panoKey(lat, lng);
  if (panoCache.has(key)) return Promise.resolve(panoCache.get(key)!);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const request = resolvePano(svService, lat, lng, radius)
    .then((result) => {
      if (panoCache.size >= PANO_CACHE_MAX) {
        const oldest = panoCache.keys().next().value;
        if (oldest !== undefined) panoCache.delete(oldest);
      }
      panoCache.set(key, result);
      return result;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, request);
  return request;
}
