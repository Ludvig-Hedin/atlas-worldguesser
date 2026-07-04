"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { findPanorama, hasGoogleMapsAuthFailed, loadGoogleMaps } from "@/lib/google-maps";
import type { GameLocation, Movement } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard";
import { PanoramaControls } from "./panorama-controls";
import { CompassStrip } from "./compass-strip";

function optionsFor(movement: Movement): google.maps.StreetViewPanoramaOptions {
  const moving = movement === "moving";
  const nmpz = movement === "noMoveNoPanZoom";
  return {
    addressControl: false,
    showRoadLabels: true,
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
  /** "load" = the Maps API failed to load; "auth" = it loaded but Google
   *  rejected the key/referer (re-rolling won't help in either case);
   *  "coverage" = no panorama near this location. */
  onUnavailable: (reason?: "load" | "coverage" | "auth") => void;
}

export function GoogleStreetView({ location, movement, onUnavailable }: Props) {
  const holderRef = useRef<HTMLDivElement>(null);
  const panoRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const svcRef = useRef<google.maps.StreetViewService | null>(null);
  const povListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const [ready, setReady] = useState(false);
  const [loadingPano, setLoadingPano] = useState(true);
  const [heading, setHeading] = useState(0);

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
  // TODO(bug-hunt): each remount ("Play again" bumps gameKey) constructs a new
  // StreetViewPanorama holding a WebGL context, and Google provides no destroy
  // API — long sessions can accumulate leaked contexts (browser cap ~16).
  // Consider setVisible(false) on cleanup and/or a singleton panorama that gets
  // re-parented instead of recreated.
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
        povListenerRef.current = panoRef.current.addListener("pov_changed", () => {
          if (panoRef.current) setHeading(panoRef.current.getPov().heading);
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) onUnavailableRef.current("load");
      });
    return () => {
      cancelled = true;
      povListenerRef.current?.remove();
      povListenerRef.current = null;
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
          onUnavailableRef.current(hasGoogleMapsAuthFailed() ? "auth" : "coverage");
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
          onUnavailableRef.current(hasGoogleMapsAuthFailed() ? "auth" : "coverage");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ready, location.lat, location.lng, location.heading, location.pitch]);

  const canPanZoom = movement !== "noMoveNoPanZoom";

  // "+ / −  Zoom in / out" — advertised in the keyboard legend.
  const zoomBy = useCallback((delta: number) => {
    const p = panoRef.current;
    if (p) p.setZoom(Math.max(0, Math.min(5, p.getZoom() + delta)));
  }, []);
  useKeyboardShortcuts(
    {
      "+": () => zoomBy(1),
      "=": () => zoomBy(1),
      "-": () => zoomBy(-1),
    },
    ready && canPanZoom,
  );

  return (
    <div className="relative h-full w-full">
      <div ref={holderRef} className="h-full w-full [&_.gm-style-cc]:hidden" />
      {ready && !loadingPano && (
        <>
          <CompassStrip heading={heading} />
          <PanoramaControls
            headingDeg={heading}
            showZoom={canPanZoom}
            onResetNorth={
              canPanZoom
                ? () => {
                    const p = panoRef.current;
                    if (p) p.setPov({ heading: 0, pitch: p.getPov().pitch });
                  }
                : undefined
            }
            onZoomIn={() => {
              const p = panoRef.current;
              if (p) p.setZoom(Math.min(5, p.getZoom() + 1));
            }}
            onZoomOut={() => {
              const p = panoRef.current;
              if (p) p.setZoom(Math.max(0, p.getZoom() - 1));
            }}
          />
        </>
      )}
      {(!ready || loadingPano) && (
        <div className="absolute inset-0">
          <Skeleton className="h-full w-full rounded-none" />
        </div>
      )}
    </div>
  );
}
