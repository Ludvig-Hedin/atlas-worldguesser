"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CARTO_DARK_STYLE } from "@/lib/map-style";
import { cn } from "@/lib/utils";

interface RevealGuess {
  username: string;
  guess: { lat: number; lng: number } | null;
  score: number;
}

interface RevealMapProps {
  actual: { lat: number; lng: number };
  guesses: RevealGuess[];
  initialView: [number, number, number];
  className?: string;
}

function targetEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.innerHTML = `<div style="position:relative;width:22px;height:22px">
    <span style="position:absolute;inset:0;border-radius:9999px;background:rgba(245,196,81,.35);animation:atlasPulse 1.8s ease-out infinite"></span>
    <span style="position:absolute;inset:5px;border-radius:9999px;background:#f5c451;border:2px solid #04140d"></span>
  </div>`;
  return el;
}

function guessEl(initial: string): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText =
    "display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:9999px 9999px 9999px 2px;background:#10b981;color:#04140d;font:600 11px/1 ui-sans-serif,system-ui;border:2px solid #04140d;box-shadow:0 2px 4px rgba(0,0,0,.5)";
  el.textContent = initial.toUpperCase();
  return el;
}

export function RevealMap({ actual, guesses, initialView, className }: RevealMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: CARTO_DARK_STYLE,
      center: [initialView[0], initialView[1]],
      zoom: initialView[2],
      attributionControl: false,
      dragRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disable();

    const markers: maplibregl.Marker[] = [];
    map.on("load", () => {
      const bounds = new maplibregl.LngLatBounds([actual.lng, actual.lat], [actual.lng, actual.lat]);
      markers.push(
        new maplibregl.Marker({ element: targetEl(), anchor: "center" })
          .setLngLat([actual.lng, actual.lat])
          .addTo(map),
      );
      const lines: GeoJSON.Feature[] = [];
      for (const g of guesses) {
        if (!g.guess) continue;
        markers.push(
          new maplibregl.Marker({ element: guessEl(g.username.slice(0, 1)), anchor: "bottom" })
            .setLngLat([g.guess.lng, g.guess.lat])
            .addTo(map),
        );
        bounds.extend([g.guess.lng, g.guess.lat]);
        lines.push({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [g.guess.lng, g.guess.lat],
              [actual.lng, actual.lat],
            ],
          },
        });
      }
      map.addSource("lines", { type: "geojson", data: { type: "FeatureCollection", features: lines } });
      map.addLayer({
        id: "lines",
        type: "line",
        source: "lines",
        paint: { "line-color": "#f5c451", "line-width": 1.5, "line-dasharray": [1.5, 1.5], "line-opacity": 0.6 },
      });
      map.fitBounds(bounds, { padding: 64, maxZoom: 7, duration: 600 });
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      markers.forEach((m) => m.remove());
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual.lat, actual.lng]);

  return <div ref={containerRef} className={cn("h-full w-full", className)} />;
}
