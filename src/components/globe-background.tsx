"use client";

import { useEffect, useRef } from "react";
import { GLOBE_POINTS } from "@/lib/globe-points";

// One calm rotation roughly every two minutes.
const RADIANS_PER_SECOND = (Math.PI * 2) / 120;
const INITIAL_CENTER_LON = (-78 * Math.PI) / 180;
const DENSITY = 16000; // point id cutoff — lower = sparser, cleaner
const SCALE = 0.5; // globe radius as fraction of min(viewport w, h)

/**
 * Ambient dotted globe rendered to a canvas. Light dots on the dark theme,
 * spins slowly, pauses when the tab is hidden or reduced-motion is requested.
 * Purely decorative: pointer-events off, aria-hidden.
 */
export function GlobeBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let paused = media.matches;
    let rotation = 0;
    let lastTime = performance.now();
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;

    // Cache dot colors by quantized alpha to avoid per-frame string churn.
    const colorCache = new Map<number, string>();
    const colorFor = (alpha: number) => {
      const key = Math.round(alpha * 50);
      let c = colorCache.get(key);
      if (!c) {
        c = `rgba(200, 216, 245, ${(key / 50).toFixed(2)})`;
        colorCache.set(key, c);
      }
      return c;
    };

    function draw() {
      if (!width || !height) return;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, width, height);

      const size = Math.min(width, height);
      const globeRadius = size * SCALE;
      const cx = width * 0.5;
      const cy = height * 0.5;
      const centerLon = INITIAL_CENTER_LON + rotation;
      const baseDotRadius = Math.max(0.6, size / 470);

      for (const point of GLOBE_POINTS) {
        if (point[0] >= DENSITY) continue;

        const lat = point[1];
        const lon = point[2];
        const relLon = lon - centerLon;
        const cosLat = Math.cos(lat);

        const sphereZ = cosLat * Math.cos(relLon);
        if (sphereZ <= 0.018) continue; // behind the horizon

        const sphereX = cosLat * Math.sin(relLon);
        const sphereY = Math.sin(lat);

        const x = cx + sphereX * globeRadius;
        const y = cy - sphereY * globeRadius;
        const perspective = 0.72 + sphereZ * 0.28;

        ctx!.fillStyle = colorFor(0.16 + sphereZ * 0.5);
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
        rotation += RADIANS_PER_SECOND * dt;
        draw();
      }
      raf = requestAnimationFrame(frame);
    }

    const onMotion = (e: MediaQueryListEvent) => {
      paused = e.matches;
    };
    const onVisible = () => {
      lastTime = performance.now();
    };

    media.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", onVisible);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      media.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
