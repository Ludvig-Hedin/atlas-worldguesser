"use client";

import { useCallback, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LatLng } from "@/lib/types";
import { mapStyleFor } from "@/lib/map-style";
import { circlePolygon } from "@/lib/geo";
import { usePreferences } from "@/hooks/use-preferences";
import { cn } from "@/lib/utils";

export interface HintCircle {
  center: LatLng;
  radiusMeters: number;
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function guessPin(): HTMLDivElement {
  const el = document.createElement("div");
  el.innerHTML = `
    <svg width="30" height="38" viewBox="0 0 30 38" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 4px rgba(0,0,0,.5))">
      <path d="M15 37c6-8 13-13.5 13-22C28 6.7 22.2 1 15 1S2 6.7 2 15c0 8.5 7 14 13 22Z" fill="#0a84ff" stroke="#0b0b0c" stroke-width="1.25"/>
      <circle cx="15" cy="15" r="5" fill="#ffffff"/>
    </svg>`;
  el.style.cursor = "pointer";
  return el;
}

function actualPin(): HTMLDivElement {
  const el = document.createElement("div");
  el.innerHTML = `
    <div style="position:relative;width:22px;height:22px">
      <span style="position:absolute;inset:0;border-radius:9999px;background:rgba(245,196,81,.35);animation:atlasPulse 1.8s ease-out infinite"></span>
      <span style="position:absolute;inset:5px;border-radius:9999px;background:#f5c451;border:2px solid #0b0b0c"></span>
    </div>`;
  return el;
}

/**
 * (Re)adds the guess overlay sources + layers. Idempotent so it can run on the
 * initial style load AND after a basemap switch (setStyle clears style-owned
 * sources/layers; DOM markers survive on their own).
 */
function addOverlays(map: maplibregl.Map) {
  if (!map.getSource("result-line")) {
    map.addSource("result-line", { type: "geojson", data: EMPTY_FC });
    map.addLayer({
      id: "result-line",
      type: "line",
      source: "result-line",
      paint: {
        "line-color": "#f5c451",
        "line-width": 2,
        "line-dasharray": [1.5, 1.5],
        "line-opacity": 0.9,
      },
    });
  }
  if (!map.getSource("hint-circle")) {
    map.addSource("hint-circle", { type: "geojson", data: EMPTY_FC });
    map.addLayer({
      id: "hint-fill",
      type: "fill",
      source: "hint-circle",
      paint: { "fill-color": "#0a84ff", "fill-opacity": 0.12 },
    });
    map.addLayer({
      id: "hint-line",
      type: "line",
      source: "hint-circle",
      paint: { "line-color": "#0a84ff", "line-width": 2, "line-opacity": 0.75, "line-dasharray": [2, 2] },
    });
  }
}

interface GuessMapProps {
  guess: LatLng | null;
  onGuess?: (g: LatLng) => void;
  actual?: LatLng | null;
  reveal?: boolean;
  initialView: [number, number, number];
  interactive?: boolean;
  hintCircle?: HintCircle | null;
  className?: string;
  /** Extra bottom padding (px) to keep pins clear of an overlaid result card. */
  bottomInset?: number;
}

export function GuessMap({
  guess,
  onGuess,
  actual,
  reveal = false,
  initialView,
  interactive = true,
  hintCircle,
  className,
  bottomInset = 0,
}: GuessMapProps) {
  const { mapType } = usePreferences();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const guessMarker = useRef<maplibregl.Marker | null>(null);
  const actualMarker = useRef<maplibregl.Marker | null>(null);
  const loadedRef = useRef(false);
  const onGuessRef = useRef(onGuess);
  useEffect(() => {
    onGuessRef.current = onGuess;
  });

  // Repaint the hint circle from the current props.
  const applyHint = useCallback(() => {
    const map = mapRef.current;
    const src = map?.getSource("hint-circle") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(
      hintCircle
        ? { type: "FeatureCollection", features: [circlePolygon(hintCircle.center, hintCircle.radiusMeters)] }
        : EMPTY_FC,
    );
  }, [hintCircle]);

  // Repaint the actual marker + result line (and fit) from the current props.
  const applyReveal = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("result-line") as maplibregl.GeoJSONSource | undefined;
    if (reveal && actual) {
      if (!actualMarker.current) {
        actualMarker.current = new maplibregl.Marker({ element: actualPin(), anchor: "center" });
      }
      actualMarker.current.setLngLat([actual.lng, actual.lat]).addTo(map);
      if (guess) {
        source?.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: [
                  [guess.lng, guess.lat],
                  [actual.lng, actual.lat],
                ],
              },
            },
          ],
        });
        const bounds = new maplibregl.LngLatBounds([guess.lng, guess.lat], [guess.lng, guess.lat]);
        bounds.extend([actual.lng, actual.lat]);
        map.fitBounds(bounds, {
          padding: { top: 80, bottom: 80 + bottomInset, left: 80, right: 80 },
          maxZoom: 7,
          duration: 800,
        });
      } else {
        map.flyTo({
          center: [actual.lng, actual.lat],
          zoom: 4,
          duration: 700,
          padding: { top: 80, bottom: 80 + bottomInset, left: 80, right: 80 },
        });
      }
    } else {
      actualMarker.current?.remove();
      actualMarker.current = null;
      source?.setData(EMPTY_FC);
    }
  }, [reveal, actual, guess, bottomInset]);

  // Stable refs so the basemap-switch effect can repaint without re-subscribing.
  const applyHintRef = useRef(applyHint);
  const applyRevealRef = useRef(applyReveal);
  useEffect(() => {
    applyHintRef.current = applyHint;
    applyRevealRef.current = applyReveal;
  }, [applyHint, applyReveal]);

  // Initialise the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyleFor(mapType),
      center: [initialView[0], initialView[1]],
      zoom: initialView[2],
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      maxZoom: 18,
      renderWorldCopies: true,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disable();
    map.on("click", (e) => {
      onGuessRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });
    map.on("load", () => {
      loadedRef.current = true;
      addOverlays(map);
      applyHintRef.current();
      applyRevealRef.current();
    });
    mapRef.current = map;

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap the basemap when the map-type preference changes; re-add overlays and
  // repaint once the new style has loaded.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    map.setStyle(mapStyleFor(mapType));
    map.once("styledata", () => {
      addOverlays(map);
      applyHintRef.current();
      applyRevealRef.current();
    });
  }, [mapType]);

  // Reflect the guess marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!guess) {
      guessMarker.current?.remove();
      guessMarker.current = null;
      return;
    }
    if (!guessMarker.current) {
      guessMarker.current = new maplibregl.Marker({ element: guessPin(), anchor: "bottom" });
    }
    guessMarker.current.setLngLat([guess.lng, guess.lat]).addTo(map);
  }, [guess]);

  // Draw / clear the hint circle.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (loadedRef.current) applyHint();
    else map.once("load", applyHint);
  }, [applyHint]);

  // Toggle interactivity (locked during reveal).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handlers = [
      map.dragPan,
      map.scrollZoom,
      map.doubleClickZoom,
      map.touchZoomRotate,
      map.boxZoom,
    ];
    const enabled = interactive && !reveal;
    for (const h of handlers) {
      if (enabled) h.enable();
      else h.disable();
    }
    if (containerRef.current) {
      containerRef.current.style.cursor = enabled ? "crosshair" : "default";
    }
  }, [interactive, reveal]);

  // Reveal: draw actual marker + line, fit both into view.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (loadedRef.current) applyReveal();
    else map.once("load", applyReveal);
  }, [applyReveal]);

  return <div ref={containerRef} className={cn("h-full w-full", className)} />;
}
