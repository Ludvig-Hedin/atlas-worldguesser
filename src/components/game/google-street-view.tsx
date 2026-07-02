"use client";

import { useEffect, useRef, useState } from "react";
import { findPanorama, loadGoogleMaps } from "@/lib/google-maps";
import type { GameLocation, Movement } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

function optionsFor(movement: Movement): google.maps.StreetViewPanoramaOptions {
  const moving = movement === "moving";
  const nmpz = movement === "noMoveNoPanZoom";
  return {
    addressControl: false,
    showRoadLabels: false,
    motionTracking: false,
    motionTrackingControl: false,
    fullscreenControl: false,
    enableCloseButton: false,
    imageDateControl: false,
    zoomControl: !nmpz,
    scrollwheel: !nmpz,
    panControl: false,
    linksControl: moving,
    clickToGo: moving,
    disableDefaultUI: nmpz,
  };
}

interface Props {
  location: GameLocation;
  movement: Movement;
  onUnavailable: () => void;
}

export function GoogleStreetView({ location, movement, onUnavailable }: Props) {
  const holderRef = useRef<HTMLDivElement>(null);
  const panoRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const svcRef = useRef<google.maps.StreetViewService | null>(null);
  const [ready, setReady] = useState(false);
  const [loadingPano, setLoadingPano] = useState(true);

  // Keep the latest callback without making it an effect dependency (which would
  // re-trigger the billed panorama lookup on every parent rerender).
  const onUnavailableRef = useRef(onUnavailable);
  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  });

  // The location key we've already resolved a panorama for. Guarantees exactly
  // one Street View Metadata call per distinct location (no per-render billing).
  const loadedKeyRef = useRef<string | null>(null);

  // Initialise the panorama + service exactly once.
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !holderRef.current) return;
        svcRef.current = new g.maps.StreetViewService();
        panoRef.current = new g.maps.StreetViewPanorama(holderRef.current, {
          visible: true,
          ...optionsFor(movement),
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) onUnavailableRef.current();
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-apply movement constraints when difficulty changes.
  useEffect(() => {
    if (ready && panoRef.current) panoRef.current.setOptions(optionsFor(movement));
  }, [movement, ready]);

  // Resolve and load the panorama once per distinct location.
  useEffect(() => {
    if (!ready || !svcRef.current || !panoRef.current) return;
    const key = `${location.lat.toFixed(5)},${location.lng.toFixed(5)}`;
    if (loadedKeyRef.current === key) return; // already resolved — skip the billed call
    loadedKeyRef.current = key;

    let cancelled = false;
    setLoadingPano(true);
    findPanorama(svcRef.current, location.lat, location.lng)
      .then((res) => {
        if (cancelled) return;
        if (!res) {
          loadedKeyRef.current = null;
          onUnavailableRef.current();
          return;
        }
        const pano = panoRef.current!;
        pano.setPano(res.panoId);
        pano.setPov({ heading: location.heading ?? res.heading, pitch: location.pitch ?? 0 });
        pano.setZoom(0);
        setLoadingPano(false);
      })
      .catch(() => {
        if (!cancelled) {
          loadedKeyRef.current = null;
          onUnavailableRef.current();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ready, location.lat, location.lng, location.heading, location.pitch]);

  return (
    <div className="relative h-full w-full">
      <div ref={holderRef} className="h-full w-full [&_.gm-style-cc]:hidden" />
      {(!ready || loadingPano) && (
        <div className="absolute inset-0">
          <Skeleton className="h-full w-full rounded-none" />
        </div>
      )}
    </div>
  );
}
