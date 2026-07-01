/**
 * Client-safe feature flags derived from public env vars.
 *
 * The app is designed to boot and be fully playable (solo, demo panoramas)
 * with ZERO configuration. Each integration lights up when its key appears.
 * Only `NEXT_PUBLIC_*` vars are readable in the browser.
 */

export const googleMapsBrowserKey =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY?.trim() || "";

export const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim() || "";

export const clerkPublishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || "";

export const features = {
  /** Real Google Street View available (else bundled demo panoramas). */
  googleMaps: googleMapsBrowserKey.length > 0,
  /** Convex realtime backend configured (required for multiplayer + persistence). */
  convex: convexUrl.length > 0,
  /** Clerk auth configured (required for profiles, friends, saved stats). */
  auth: clerkPublishableKey.length > 0 && convexUrl.length > 0,
} as const;

export type Features = typeof features;
