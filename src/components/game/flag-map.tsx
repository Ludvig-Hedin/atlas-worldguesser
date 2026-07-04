"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection } from "geojson";
import { loadCountries } from "@/lib/geo";
import { blankCountryStyle, countryPaint } from "@/lib/map-style";
import { usePreferences } from "@/hooks/use-preferences";
import { resolveTheme } from "@/lib/preferences";
import { cn } from "@/lib/utils";

/** How a country is currently painted on the map. */
export type FlagCellStatus = "wrong1" | "wrong2" | "wrong3" | "revealed" | "correct";

interface FlagMapProps {
  /** ISO → answer status for the current flag; drives feature-state coloring. */
  status: Record<string, FlagCellStatus>;
  /** Fired with the clicked country's ISO (ocean clicks are ignored). */
  onPick: (iso: string) => void;
  initialView: [number, number, number];
  /** Locks clicks + hover while a reveal is showing. */
  interactive?: boolean;
  className?: string;
}

const HIT_BOX = 4; // px tolerance so micro-states are clickable

export function FlagMap({ status, onPick, initialView, interactive = true, className }: FlagMapProps) {
  const { theme } = usePreferences();
  const dark = resolveTheme(theme) === "dark";

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const hoveredRef = useRef<string | null>(null);
  const statusRef = useRef<Record<string, FlagCellStatus>>({});
  const prevStatusRef = useRef<Record<string, FlagCellStatus>>({});
  const interactiveRef = useRef(interactive);
  const onPickRef = useRef(onPick);
  const [fc, setFc] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    onPickRef.current = onPick;
  });
  useEffect(() => {
    interactiveRef.current = interactive;
  }, [interactive]);

  // Lazily pull the bundled polygons (kept out of the initial bundle).
  useEffect(() => {
    let alive = true;
    loadCountries().then((data) => {
      if (alive) setFc(data as unknown as FeatureCollection);
    });
    return () => {
      alive = false;
    };
  }, []);

  const isoAtPoint = (map: maplibregl.Map, pt: maplibregl.Point): string | null => {
    const box: [maplibregl.PointLike, maplibregl.PointLike] = [
      [pt.x - HIT_BOX, pt.y - HIT_BOX],
      [pt.x + HIT_BOX, pt.y + HIT_BOX],
    ];
    const feats = map.queryRenderedFeatures(box, { layers: ["country-fill"] });
    const iso = feats[0]?.properties?.iso;
    return typeof iso === "string" ? iso : null;
  };

  // Initialise the map once the polygons are ready.
  useEffect(() => {
    if (!containerRef.current || !fc || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: blankCountryStyle(dark, fc),
      center: [initialView[0], initialView[1]],
      zoom: initialView[2],
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      maxZoom: 7,
      renderWorldCopies: true,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disable();

    map.on("click", (e) => {
      if (!interactiveRef.current) return;
      const iso = isoAtPoint(map, e.point);
      if (iso) onPickRef.current(iso);
    });

    map.on("mousemove", (e) => {
      if (!interactiveRef.current) {
        map.getCanvas().style.cursor = "";
        return;
      }
      const iso = isoAtPoint(map, e.point);
      map.getCanvas().style.cursor = iso ? "pointer" : "";
      if (iso === hoveredRef.current) return;
      if (hoveredRef.current) {
        map.removeFeatureState({ source: "countries", id: hoveredRef.current }, "hover");
      }
      hoveredRef.current = iso;
      if (iso) map.setFeatureState({ source: "countries", id: iso }, { hover: true });
    });

    map.on("mouseout", () => {
      if (hoveredRef.current) {
        map.removeFeatureState({ source: "countries", id: hoveredRef.current }, "hover");
        hoveredRef.current = null;
      }
    });

    map.on("load", () => {
      loadedRef.current = true;
      applyStatus(map, statusRef.current, {});
      prevStatusRef.current = statusRef.current;
    });
    mapRef.current = map;

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
      hoveredRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fc]);

  // Diff the status map onto feature-state (one repaint per changed country).
  useEffect(() => {
    const map = mapRef.current;
    statusRef.current = status;
    if (!map || !loadedRef.current) return;
    applyStatus(map, status, prevStatusRef.current);
    prevStatusRef.current = status;
  }, [status]);

  // Recolor in place on theme change — never setStyle (would wipe feature-state).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const p = countryPaint(dark);
    map.setPaintProperty("bg", "background-color", p.ocean);
    map.setPaintProperty("country-fill", "fill-color", p.fillColor);
    map.setPaintProperty("country-border", "line-color", p.border);
  }, [dark]);

  return (
    <div className={cn("relative h-full w-full", className)}>
      <div ref={containerRef} className="h-full w-full" />
      {!fc && (
        <div className="absolute inset-0 grid place-items-center bg-background text-sm text-muted-foreground">
          Loading map…
        </div>
      )}
    </div>
  );
}

/** Apply the new status map to feature-state, clearing entries that disappeared. */
function applyStatus(
  map: maplibregl.Map,
  next: Record<string, FlagCellStatus>,
  prev: Record<string, FlagCellStatus>,
) {
  for (const iso of Object.keys(prev)) {
    if (!(iso in next)) map.removeFeatureState({ source: "countries", id: iso }, "status");
  }
  for (const [iso, s] of Object.entries(next)) {
    if (prev[iso] !== s) map.setFeatureState({ source: "countries", id: iso }, { status: s });
  }
}
