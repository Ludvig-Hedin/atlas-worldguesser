"use client";

import { useCallback, useEffect, useState } from "react";
import { features } from "@/lib/env";
import { demoScene } from "@/lib/demo-scene";
import type { GameLocation, Movement } from "@/lib/types";
import { hashString } from "@/lib/utils";
import { DemoPanorama } from "./demo-panorama";
import { GoogleStreetView } from "./google-street-view";

interface Props {
  location: GameLocation;
  movement: Movement;
  /** Called when Google has no coverage ("coverage") or the Maps API itself
   * failed to load ("load"). If provided, the parent handles it (e.g. re-rolls
   * to another location) and no demo view is shown. */
  onUnavailable?: (reason?: "load" | "coverage") => void;
  /** Force the demo view (e.g. after coverage re-rolls are exhausted). */
  forceDemo?: boolean;
}

/**
 * Unified panorama surface. Uses Google Street View when a key is present and
 * coverage exists; otherwise either delegates (onUnavailable) or shows the demo.
 */
export function StreetViewCanvas({ location, movement, onUnavailable, forceDemo }: Props) {
  const [localFallback, setLocalFallback] = useState(false);

  // Retry Google coverage whenever the location changes (by value).
  useEffect(() => {
    setLocalFallback(false);
  }, [location.lat, location.lng]);

  const handleUnavailable = useCallback(
    (reason?: "load" | "coverage") => {
      if (onUnavailable) onUnavailable(reason);
      else setLocalFallback(true);
    },
    [onUnavailable],
  );

  const demoMode = !features.googleMaps || forceDemo || localFallback;
  const nmpz = movement === "noMoveNoPanZoom";
  const scene = demoScene(location);
  const seed = hashString(`${location.lat.toFixed(4)},${location.lng.toFixed(4)}`);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {demoMode ? (
        <DemoPanorama scene={scene} seed={seed} disablePan={nmpz} hasGoogleKey={features.googleMaps} />
      ) : (
        <GoogleStreetView location={location} movement={movement} onUnavailable={handleUnavailable} />
      )}
      {/* NMPZ: block all look-around / zoom over the real panorama. */}
      {nmpz && !demoMode && <div className="absolute inset-0 z-10 cursor-not-allowed" aria-hidden />}
    </div>
  );
}
