"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ImageOff } from "lucide-react";
import type { DemoScene } from "@/lib/demo-scene";
import { cn, seededRandom } from "@/lib/utils";
import { CompassStrip } from "./compass-strip";
import { PanoramaControls } from "./panorama-controls";

/** Build a filled ridge polygon spanning [0..width], repeated once for seamless wrap. */
function ridgePath(seed: number, width: number, height: number, baseline: number, amp: number) {
  const rng = seededRandom(seed);
  const steps = 16;
  const ys: number[] = [];
  for (let i = 0; i <= steps; i++) ys.push(baseline - rng() * amp - amp * 0.15);
  const segment = (offset: number) =>
    ys
      .map((y, i) => `${((i / steps) * width + offset).toFixed(1)},${y.toFixed(1)}`)
      .join(" L");
  return `M0,${height} L0,${baseline} L${segment(0)} L${segment(width)} L${(2 * width).toFixed(1)},${baseline} L${(2 * width).toFixed(1)},${height} Z`;
}

interface DemoPanoramaProps {
  scene: DemoScene;
  seed: number;
  /** Disable panning (NMPZ difficulty). */
  disablePan?: boolean;
  /** Whether a Google key exists (changes the fallback caption). */
  hasGoogleKey?: boolean;
  className?: string;
}

const W = 1200;
const H = 600;
const BASE = 360;

export function DemoPanorama({ scene, seed, disablePan, hasGoogleKey, className }: DemoPanoramaProps) {
  const [heading, setHeading] = useState(0.12);
  const drag = useRef<{ x: number; start: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const layers = useMemo(
    () => [
      { path: ridgePath(seed + 1, W, H, BASE + 40, 60), color: scene.horizon, opacity: 0.5, factor: 0.35 },
      { path: ridgePath(seed + 2, W, H, BASE + 90, 110), color: scene.ground, opacity: 0.8, factor: 0.6 },
      { path: ridgePath(seed + 3, W, H, BASE + 150, 150), color: "#0a0a0b", opacity: 0.92, factor: 1 },
    ],
    [seed, scene.horizon, scene.ground],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disablePan) return;
      drag.current = { x: e.clientX, start: heading };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [disablePan, heading],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current || !containerRef.current) return;
    const width = containerRef.current.clientWidth || 1;
    const dx = (e.clientX - drag.current.x) / width;
    let next = (drag.current.start - dx * 0.9) % 1;
    if (next < 0) next += 1;
    setHeading(next);
  }, []);

  const endDrag = useCallback(() => {
    drag.current = null;
  }, []);

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      className={cn(
        "relative h-full w-full select-none overflow-hidden touch-none",
        disablePan ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        className,
      )}
      style={{ background: `linear-gradient(180deg, ${scene.skyTop} 0%, ${scene.skyBottom} 62%, ${scene.skyBottom} 100%)` }}
      role="img"
      aria-label="Demo panorama — configure a Google Maps key for real Street View"
    >
      {/* Sun/light source, panning slowly with the view */}
      <div
        className="pointer-events-none absolute size-40 rounded-full blur-2xl"
        style={{
          top: "12%",
          left: `${(0.7 - heading * 0.3) * 100}%`,
          background: `radial-gradient(circle, hsla(${scene.hue}, 80%, 78%, 0.55), transparent 65%)`,
        }}
      />
      {layers.map((layer, i) => {
        let offset = (heading * layer.factor) % 1;
        if (offset < 0) offset += 1;
        return (
          <svg
            key={i}
            viewBox={`0 0 ${2 * W} ${H}`}
            preserveAspectRatio="xMidYMax slice"
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ transform: `translateX(${-offset * 50}%)`, width: "200%" }}
          >
            <path d={layer.path} fill={layer.color} opacity={layer.opacity} />
          </svg>
        );
      })}

      {/* Vignette for depth */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_20%,transparent_40%,rgba(0,0,0,0.45)_100%)]" />

      <CompassStrip heading={heading * 360} />
      <PanoramaControls
        headingDeg={heading * 360}
        showZoom={false}
        onResetNorth={disablePan ? undefined : () => setHeading(0)}
      />

      <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-[11px] font-medium text-white/70 backdrop-blur">
        <ImageOff className="size-3" />
        {hasGoogleKey
          ? "No Street View here — showing a demo view"
          : "Demo panorama — add a Google Maps key for real Street View"}
      </div>
    </div>
  );
}
