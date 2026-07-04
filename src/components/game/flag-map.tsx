"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
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

// Never a flag answer (mirrors pool.ts's NON_COUNTRY) and only clutters the
// blank map — Antarctica in particular renders enormous under Mercator.
const NON_MAP_ISO = new Set(["AQ", "TF"]);

/** Signed area + centroid of a single ring via the shoelace formula. */
function ringCentroid(ring: number[][]): { x: number; y: number; area: number } {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const cross = x1 * y2 - x2 * y1;
    area += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  area /= 2;
  if (area === 0) return { x: ring[0][0], y: ring[0][1], area: 0 };
  return { x: cx / (6 * area), y: cy / (6 * area), area: Math.abs(area) };
}

/** Centroid of a country's largest ring — keeps the marker on the main
 *  landmass for archipelagos instead of averaging into open ocean. */
function countryCentroid(geometry: Polygon | MultiPolygon): [number, number] {
  const rings = geometry.type === "Polygon" ? [geometry.coordinates[0]] : geometry.coordinates.map((p) => p[0]);
  let best = { x: 0, y: 0, area: -1 };
  for (const ring of rings) {
    if (!ring || ring.length < 4) continue;
    const c = ringCentroid(ring);
    if (c.area > best.area) best = c;
  }
  return [best.x, best.y];
}

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
  const centroidsRef = useRef<Map<string, [number, number]>>(new Map());
  const revealMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [fc, setFc] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    onPickRef.current = onPick;
  });
  useEffect(() => {
    interactiveRef.current = interactive;
  }, [interactive]);

  // Lazily pull the bundled polygons (kept out of the initial bundle). Drop
  // non-country landmasses (Antarctica etc.) — they can never be an answer
  // and just clutter/inflate the blank map.
  useEffect(() => {
    let alive = true;
    loadCountries().then((data) => {
      if (!alive) return;
      const raw = data as unknown as FeatureCollection;
      const features = raw.features.filter((f) => !NON_MAP_ISO.has((f.properties as { iso?: string })?.iso ?? ""));
      const centroids = new Map<string, [number, number]>();
      for (const f of features) {
        const iso = (f.properties as { iso?: string }).iso;
        if (iso && !centroids.has(iso)) centroids.set(iso, countryCentroid(f.geometry as Polygon | MultiPolygon));
      }
      centroidsRef.current = centroids;
      setFc({ ...raw, features });
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
      revealMarkerRef.current?.remove();
      revealMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
      hoveredRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fc]);

  // Diff the status map onto feature-state (one repaint per changed country),
  // and pin the answer's flag over its shape while it's shown in green.
  useEffect(() => {
    const map = mapRef.current;
    statusRef.current = status;
    if (!map || !loadedRef.current) return;
    applyStatus(map, status, prevStatusRef.current);
    prevStatusRef.current = status;

    const answerIso = Object.entries(status).find(([, s]) => s === "correct" || s === "revealed")?.[0];
    const pos = answerIso ? centroidsRef.current.get(answerIso) : undefined;
    revealMarkerRef.current?.remove();
    revealMarkerRef.current = null;
    if (answerIso && pos) {
      const el = document.createElement("div");
      el.className = "pointer-events-none animate-fade-up";
      const img = document.createElement("img");
      img.src = `/flags/${answerIso.toLowerCase()}.svg`;
      img.alt = "";
      img.className = "h-5 w-8 rounded-sm object-cover ring-2 ring-white/90 shadow-2 sm:h-6 sm:w-10";
      el.appendChild(img);
      revealMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(pos).addTo(map);
      // If the answer sits off-screen (small or edge country), gently bring it
      // into view so the player actually sees where it was.
      if (!map.getBounds().contains(pos)) {
        map.easeTo({ center: pos, duration: 650 });
      }
    }
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
          <Loader2 className="size-6 animate-spin text-primary-muted" />
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
