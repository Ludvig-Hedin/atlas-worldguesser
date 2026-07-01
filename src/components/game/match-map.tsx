"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CARTO_DARK_STYLE } from "@/lib/map-style";
import type { RoundResult } from "@/lib/types";
import { cn } from "@/lib/utils";

function numberedPin(n: number, color: string): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:${color};color:#04140d;font:600 11px/1 ui-sans-serif,system-ui;border:2px solid #04140d;box-shadow:0 2px 4px rgba(0,0,0,.5)`;
  el.textContent = String(n);
  return el;
}

interface MatchMapProps {
  results: RoundResult[];
  initialView: [number, number, number];
  className?: string;
}

/** Static summary map plotting every round's actual location, guess, and link. */
export function MatchMap({ results, initialView, className }: MatchMapProps) {
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
      interactive: true,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disable();

    const markers: maplibregl.Marker[] = [];
    map.on("load", () => {
      const bounds = new maplibregl.LngLatBounds();
      const lines: GeoJSON.Feature[] = [];
      results.forEach((r, i) => {
        markers.push(
          new maplibregl.Marker({ element: numberedPin(i + 1, "#f5c451"), anchor: "center" })
            .setLngLat([r.actual.lng, r.actual.lat])
            .addTo(map),
        );
        bounds.extend([r.actual.lng, r.actual.lat]);
        if (r.guess) {
          markers.push(
            new maplibregl.Marker({ element: numberedPin(i + 1, "#10b981"), anchor: "center" })
              .setLngLat([r.guess.lng, r.guess.lat])
              .addTo(map),
          );
          bounds.extend([r.guess.lng, r.guess.lat]);
          lines.push({
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [
                [r.guess.lng, r.guess.lat],
                [r.actual.lng, r.actual.lat],
              ],
            },
          });
        }
      });
      map.addSource("lines", { type: "geojson", data: { type: "FeatureCollection", features: lines } });
      map.addLayer({
        id: "lines",
        type: "line",
        source: "lines",
        paint: { "line-color": "#f5c451", "line-width": 1.5, "line-dasharray": [1.5, 1.5], "line-opacity": 0.7 },
      });
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, maxZoom: 6, duration: 0 });
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      markers.forEach((m) => m.remove());
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={cn("h-full w-full", className)} />;
}
