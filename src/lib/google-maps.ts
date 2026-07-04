/// <reference types="google.maps" />
import { googleMapsBrowserKey, googleMapsDisabled } from "./env";

let loadPromise: Promise<typeof google> | null = null;

// Google calls this global (if defined) on a bad/misconfigured key — invalid
// key, referer not allowed, API not activated, billing disabled, etc. Crucially,
// the script still finishes loading and calls the ready callback normally: the
// failure only surfaces here and in the console, never as a script/network
// error. Every panorama lookup after this point will keep silently failing, so
// callers must report it as an "auth" problem, not misread it as "no Street
// View coverage at this specific location".
let authFailed = false;

/** True once Google has reported an auth failure (bad key / referer / billing) for this page load. */
export function hasGoogleMapsAuthFailed(): boolean {
  return authFailed;
}

function installAuthFailureHook(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gm_authFailure?: () => void };
  if (w.gm_authFailure) return;
  w.gm_authFailure = () => {
    authFailed = true;
  };
}

const SCRIPT_TIMEOUT_MS = 15_000;
const PANO_TIMEOUT_MS = 10_000;
// One retry after a timeout/network error — a single dropped packet on a
// flaky connection shouldn't drop a player straight to demo mode.
const MAX_SCRIPT_ATTEMPTS = 2;

function loadGoogleMapsScript(attempt: number): Promise<typeof google> {
  return new Promise<typeof google>((resolve, reject) => {
    const callbackName = "__atlasGmapsReady";
    let settled = false;

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      script.remove();
      if (attempt < MAX_SCRIPT_ATTEMPTS) {
        loadPromise = loadGoogleMapsScript(attempt + 1);
        loadPromise.then(resolve, reject);
      } else {
        loadPromise = null;
        reject(err);
      }
    };

    const timeout = window.setTimeout(() => fail(new Error("Google Maps load timed out")), SCRIPT_TIMEOUT_MS);

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
    script.onerror = () => fail(new Error("Failed to load Google Maps JS API"));
    document.head.appendChild(script);
  });
}

/**
 * Load the Google Maps JS API. Resolves with the `google` global. Rejects (so
 * the caller falls back to demo mode) if no key is configured, the kill
 * switch is set, or the script still fails/times out after one retry.
 */
export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }
  installAuthFailureHook();
  if (googleMapsDisabled) {
    return Promise.reject(new Error("Google Maps disabled by kill switch"));
  }
  if (!googleMapsBrowserKey) {
    return Promise.reject(new Error("No Google Maps browser key configured"));
  }
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loadPromise) return loadPromise;

  loadPromise = loadGoogleMapsScript(1);
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

// Persist the resolved-pano cache across reloads/sessions (localStorage) so
// revisiting a location — same city drawn again, same daily challenge replayed
// — never re-bills the Street View Metadata API for a coordinate already
// looked up on this device.
const STORAGE_KEY = "atlas:panoCache:v1";
type StoredPano = { panoId: string; lat: number; lng: number; heading: number } | null;
let hydrated = false;

function hydrateFromStorage(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw) as [string, StoredPano][];
    for (const [key, stored] of entries) {
      if (panoCache.size >= PANO_CACHE_MAX) break;
      if (!stored) {
        panoCache.set(key, null);
        continue;
      }
      panoCache.set(key, {
        panoId: stored.panoId,
        heading: stored.heading,
        location: new google.maps.LatLng(stored.lat, stored.lng),
      });
    }
  } catch {
    // Corrupt/unavailable storage — fall back to an empty in-memory cache.
  }
}

function persistToStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const entries: [string, StoredPano][] = Array.from(panoCache.entries()).map(([key, value]) => [
      key,
      value ? { panoId: value.panoId, lat: value.location.lat(), lng: value.location.lng(), heading: value.heading } : null,
    ]);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full/unavailable/private-mode — cache still works in-memory for this tab.
  }
}

function panoKey(lat: number, lng: number, radius: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)},${radius}`;
}

function resolvePano(
  svService: google.maps.StreetViewService,
  lat: number,
  lng: number,
  radius: number,
): Promise<{ pano: PanoResolution | null; timedOut: boolean }> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (pano: PanoResolution | null, timedOut: boolean) => {
      if (settled) return;
      settled = true;
      resolve({ pano, timedOut });
    };
    // Single attempt, hard timeout — never a retry loop.
    const timeout = setTimeout(() => done(null, true), PANO_TIMEOUT_MS);
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
          done({ panoId: data.location.pano, location: data.location.latLng, heading }, false);
        } else {
          done(null, false);
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
  hydrateFromStorage();
  const key = panoKey(lat, lng, radius);
  if (panoCache.has(key)) return Promise.resolve(panoCache.get(key)!);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const request = resolvePano(svService, lat, lng, radius)
    .then(({ pano, timedOut }) => {
      // Don't cache a transient timeout as permanent "no coverage" — one flaky
      // moment shouldn't poison a real location (→ reroll/demo) for the session.
      if (!timedOut) {
        if (panoCache.size >= PANO_CACHE_MAX) {
          const oldest = panoCache.keys().next().value;
          if (oldest !== undefined) panoCache.delete(oldest);
        }
        panoCache.set(key, pano);
        persistToStorage();
      }
      return pano;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, request);
  return request;
}
