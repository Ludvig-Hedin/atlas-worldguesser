"use client";

import { useCallback, useEffect, useState } from "react";
import { features } from "@/lib/env";
import { demoScene } from "@/lib/demo-scene";
import type { GameLocation, Movement } from "@/lib/types";
import { hashString } from "@/lib/utils";
import { DemoPanorama } from "./demo-panorama";
import { GoogleStreetView } from "./google-street-view";

/** "load" = the Maps API failed to load; "auth" = it loaded but Google
 *  rejected the key/referer; "coverage" = no panorama near this location. */
export type StreetViewUnavailableReason = "load" | "coverage" | "auth";

interface Props {
  location: GameLocation;
  movement: Movement;
  /** Called when Google has no coverage or the Maps API itself failed to load
   * or authenticate. If provided, the parent handles it (e.g. re-rolls to
   * another location) and no demo view is shown. */
  onUnavailable?: (reason?: StreetViewUnavailableReason) => void;
  /** Force the demo view (e.g. after coverage re-rolls are exhausted). */
  forceDemo?: boolean;
  /** Why the parent set forceDemo — picks the right demo caption. */
  forceDemoReason?: StreetViewUnavailableReason;
}

/**
 * Unified panorama surface. Uses Google Street View when a key is present and
 * coverage exists; otherwise either delegates (onUnavailable) or shows the demo.
 */
export function StreetViewCanvas({ location, movement, onUnavailable, forceDemo, forceDemoReason }: Props) {
  const [localFallback, setLocalFallback] = useState<StreetViewUnavailableReason | null>(null);

  // Retry Google coverage whenever the location changes (by value).
  useEffect(() => {
    setLocalFallback(null);
  }, [location.lat, location.lng]);

  const handleUnavailable = useCallback(
    (reason?: StreetViewUnavailableReason) => {
      if (onUnavailable) onUnavailable(reason);
      else setLocalFallback(reason ?? "coverage");
    },
    [onUnavailable],
  );

  const demoMode = !features.googleMaps || forceDemo || localFallback !== null;
  // Only a real "coverage" failure earns the "no Street View here" copy — an
  // API/auth failure gets an honest "unavailable" message instead (see demo-panorama.tsx).
  const demoReason = forceDemo ? forceDemoReason : (localFallback ?? undefined);
  const nmpz = movement === "noMoveNoPanZoom";
  const scene = demoScene(location);
  const seed = hashString(`${location.lat.toFixed(4)},${location.lng.toFixed(4)}`);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {demoMode ? (
        <DemoPanorama
          scene={scene}
          seed={seed}
          disablePan={nmpz}
          hasGoogleKey={features.googleMaps}
          unavailableReason={demoReason}
        />
      ) : (
        <GoogleStreetView location={location} movement={movement} onUnavailable={handleUnavailable} />
      )}
      {/* NMPZ: block all look-around / zoom over the real panorama. */}
      {nmpz && !demoMode && <div className="absolute inset-0 z-10 cursor-not-allowed" aria-hidden />}
    </div>
  );
}
