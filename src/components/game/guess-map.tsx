"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LatLng } from "@/lib/types";
import { CARTO_DARK_STYLE } from "@/lib/map-style";
import { circlePolygon } from "@/lib/geo";
import { cn } from "@/lib/utils";

export interface HintCircle {
  center: LatLng;
  radiusMeters: number;
}

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

interface GuessMapProps {
  guess: LatLng | null;
  onGuess?: (g: LatLng) => void;
  actual?: LatLng | null;
  reveal?: boolean;
  initialView: [number, number, number];
  interactive?: boolean;
  hintCircle?: HintCircle | null;
  className?: string;
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
}: GuessMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const guessMarker = useRef<maplibregl.Marker | null>(null);
  const actualMarker = useRef<maplibregl.Marker | null>(null);
  const loadedRef = useRef(false);
  const onGuessRef = useRef(onGuess);
  useEffect(() => {
    onGuessRef.current = onGuess;
  });

  // Initialise the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: CARTO_DARK_STYLE,
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
      map.addSource("result-line", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
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
      map.addSource("hint-circle", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
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
    const apply = () => {
      const src = map.getSource("hint-circle") as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      src.setData(
        hintCircle
          ? { type: "FeatureCollection", features: [circlePolygon(hintCircle.center, hintCircle.radiusMeters)] }
          : { type: "FeatureCollection", features: [] },
      );
    };
    if (loadedRef.current) apply();
    else map.once("load", apply);
  }, [hintCircle]);

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
    for (const h of handlers) enabled ? h.enable() : h.disable();
    if (containerRef.current) {
      containerRef.current.style.cursor = enabled ? "crosshair" : "default";
    }
  }, [interactive, reveal]);

  // Reveal: draw actual marker + line, fit both into view.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyReveal = () => {
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
          map.fitBounds(bounds, { padding: 80, maxZoom: 7, duration: 800 });
        } else {
          map.flyTo({ center: [actual.lng, actual.lat], zoom: 4, duration: 700 });
        }
      } else {
        actualMarker.current?.remove();
        actualMarker.current = null;
        source?.setData({ type: "FeatureCollection", features: [] });
      }
    };

    if (loadedRef.current) applyReveal();
    else map.once("load", applyReveal);
  }, [reveal, actual, guess]);

  return <div ref={containerRef} className={cn("h-full w-full", className)} />;
}
