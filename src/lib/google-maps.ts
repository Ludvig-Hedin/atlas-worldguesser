/// <reference types="google.maps" />
import { googleMapsBrowserKey } from "./env";

let loadPromise: Promise<typeof google> | null = null;

/**
 * Load the Google Maps JS API exactly once. Resolves with the `google` global.
 * Rejects if no browser key is configured (caller falls back to demo mode).
 */
export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }
  if (!googleMapsBrowserKey) {
    return Promise.reject(new Error("No Google Maps browser key configured"));
  }
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<typeof google>((resolve, reject) => {
    const callbackName = "__atlasGmapsReady";
    (window as unknown as Record<string, unknown>)[callbackName] = () => {
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

/**
 * Find the nearest official Street View panorama to a coordinate.
 * Returns null when no coverage is found within the search radius.
 */
export function findPanorama(
  svService: google.maps.StreetViewService,
  lat: number,
  lng: number,
  radius = 12_000,
): Promise<PanoResolution | null> {
  return new Promise((resolve) => {
    svService.getPanorama(
      {
        location: { lat, lng },
        radius,
        preference: google.maps.StreetViewPreference.NEAREST,
        source: google.maps.StreetViewSource.OUTDOOR,
      },
      (data, status) => {
        if (
          status === google.maps.StreetViewStatus.OK &&
          data?.location?.pano &&
          data.location.latLng
        ) {
          const heading = data.tiles?.centerHeading ?? 0;
          resolve({ panoId: data.location.pano, location: data.location.latLng, heading });
        } else {
          resolve(null);
        }
      },
    );
  });
}
