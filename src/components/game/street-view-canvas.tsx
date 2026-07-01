"use client";

import { useEffect, useState } from "react";
import { features } from "@/lib/env";
import { demoScene } from "@/lib/demo-scene";
import type { GameLocation, Movement } from "@/lib/types";
import { hashString } from "@/lib/utils";
import { DemoPanorama } from "./demo-panorama";
import { GoogleStreetView } from "./google-street-view";

interface Props {
  location: GameLocation;
  movement: Movement;
}

/**
 * Unified panorama surface. Uses Google Street View when a key is present and
 * coverage exists; otherwise falls back to a deterministic demo panorama.
 */
export function StreetViewCanvas({ location, movement }: Props) {
  const [fallback, setFallback] = useState(!features.googleMaps);

  // Retry Google coverage for each new location.
  useEffect(() => {
    if (features.googleMaps) setFallback(false);
  }, [location]);

  const nmpz = movement === "noMoveNoPanZoom";
  const scene = demoScene(location);
  const seed = hashString(`${location.lat.toFixed(4)},${location.lng.toFixed(4)}`);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {fallback ? (
        <DemoPanorama scene={scene} seed={seed} disablePan={nmpz} />
      ) : (
        <GoogleStreetView location={location} movement={movement} onUnavailable={() => setFallback(true)} />
      )}
      {/* NMPZ: block all look-around / zoom over the real panorama. */}
      {nmpz && !fallback && <div className="absolute inset-0 z-10 cursor-not-allowed" aria-hidden />}
    </div>
  );
}
