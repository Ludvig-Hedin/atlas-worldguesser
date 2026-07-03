"use client";

import { useEffect, useRef } from "react";

// One rotation roughly every 50s on desktop. Mobile spins faster (see multiplier).
const RADIANS_PER_SECOND = (Math.PI * 2) / 50;
// Phones get a livelier spin — the globe is smaller there, so faster reads well.
const MOBILE_SPEED_MULTIPLIER = 1.7; // → ~30s per rotation on small viewports
const INITIAL_CENTER_LON = (-30 * Math.PI) / 180;
const SCALE = 0.44; // globe radius as fraction of min(viewport w, h) — whole Earth, uncropped
const CY = 0.5; // vertical center as fraction of height

type Point = readonly [lat: number, lon: number];

/**
 * Ambient dotted globe of Earth's land, rendered to a canvas. Points are loaded
 * from /globe.json (generated from Natural Earth land polygons). Spins slowly,
 * pauses when the tab is hidden or reduced-motion is requested. Purely
 * decorative: pointer-events off, aria-hidden.
 */
export function GlobeBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointsRef = useRef<Point[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let paused = media.matches;
    const mobileMedia = window.matchMedia("(max-width: 640px)");
    let speedMultiplier = mobileMedia.matches ? MOBILE_SPEED_MULTIPLIER : 1;
    let rotation = 0;
    let lastTime = performance.now();
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let alive = true;

    // Cache dot colors by quantized alpha to avoid per-frame string churn.
    const colorCache = new Map<number, string>();
    const colorFor = (alpha: number) => {
      const key = Math.round(alpha * 40);
      let c = colorCache.get(key);
      if (!c) {
        c = `rgba(150, 185, 255, ${(key / 40).toFixed(3)})`;
        colorCache.set(key, c);
      }
      return c;
    };

    function draw() {
      if (!width || !height) return;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, width, height);

      const points = pointsRef.current;
      if (points.length === 0) return;

      const size = Math.min(width, height);
      const globeRadius = size * SCALE;
      const cx = width * 0.5;
      const cy = height * CY;
      const centerLon = INITIAL_CENTER_LON + rotation;
      const baseDotRadius = Math.max(0.7, size / 520);

      for (const point of points) {
        const lat = point[0];
        const relLon = point[1] - centerLon;
        const cosLat = Math.cos(lat);

        const sphereZ = cosLat * Math.cos(relLon);
        if (sphereZ <= 0.02) continue; // behind the horizon

        const sphereX = cosLat * Math.sin(relLon);
        const sphereY = Math.sin(lat);

        const x = cx + sphereX * globeRadius;
        const y = cy - sphereY * globeRadius;
        const perspective = 0.7 + sphereZ * 0.3;

        ctx!.fillStyle = colorFor(0.2 + sphereZ * 0.62);
        ctx!.beginPath();
        ctx!.arc(x, y, baseDotRadius * perspective, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      draw();
    }

    function frame(now: number) {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      if (!paused && !document.hidden) {
        rotation += RADIANS_PER_SECOND * speedMultiplier * dt;
        draw();
      }
      raf = requestAnimationFrame(frame);
    }

    const onMotion = (e: MediaQueryListEvent) => {
      paused = e.matches;
    };
    const onViewport = (e: MediaQueryListEvent) => {
      speedMultiplier = e.matches ? MOBILE_SPEED_MULTIPLIER : 1;
    };
    const onVisible = () => {
      lastTime = performance.now();
    };

    media.addEventListener("change", onMotion);
    mobileMedia.addEventListener("change", onViewport);
    document.addEventListener("visibilitychange", onVisible);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    raf = requestAnimationFrame(frame);

    fetch("/globe.json")
      .then((r) => r.json())
      .then((data: Point[]) => {
        if (alive) {
          pointsRef.current = data;
          draw();
        }
      })
      .catch(() => {
        /* decorative — silently skip if unavailable */
      });

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      media.removeEventListener("change", onMotion);
      mobileMedia.removeEventListener("change", onViewport);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
