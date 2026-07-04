"use client";

import { useEffect, useRef } from "react";

// One rotation roughly every 50s on desktop. Mobile spins faster (see multiplier).
const RADIANS_PER_SECOND = (Math.PI * 2) / 50;
// Phones get a livelier spin — the globe is smaller there, so faster reads well.
const MOBILE_SPEED_MULTIPLIER = 1.7; // → ~30s per rotation on small viewports
const INITIAL_CENTER_LON = (-30 * Math.PI) / 180;
const SCALE = 0.44; // globe radius as fraction of min(viewport w, h) — whole Earth, uncropped
const CY = 0.5; // vertical center as fraction of height

// Pointer parallax — globe leans toward the cursor, stars drift underneath it.
const MAX_YAW_TILT = 0.16; // extra longitude rotation at full pointer deflection (rad)
const MAX_PITCH_TILT = 0.1; // extra latitude tilt at full pointer deflection (rad)
const STAR_PARALLAX_FACTOR = 0.05; // fraction of globe size a far star shifts by
const POINTER_EASE_PER_SECOND = 6; // exponential smoothing rate for the lerp

// Stars: one per ~9000px^2 of canvas, clamped to a sane range.
const STAR_DENSITY = 1 / 9000;
const MIN_STARS = 90;
const MAX_STARS = 220;

type Point = readonly [lat: number, lon: number];

type Star = {
  x: number; // normalized 0..1 across width
  y: number; // normalized 0..1 across height
  radius: number;
  depth: number; // 0.3..1 — parallax + twinkle magnitude
  phase: number;
  speed: number;
};

function makeStars(width: number, height: number): Star[] {
  const count = Math.min(MAX_STARS, Math.max(MIN_STARS, Math.round(width * height * STAR_DENSITY)));
  return Array.from({ length: count }, () => {
    const depth = 0.3 + Math.random() * 0.7;
    return {
      x: Math.random(),
      y: Math.random(),
      radius: 0.5 + depth * 1.1,
      depth,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.9,
    };
  });
}

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
    // Parallax follows a real mouse only — ignore touch so scrolling on
    // mobile never gets read as pointer movement.
    const finePointerMedia = window.matchMedia("(pointer: fine)");
    let pointerEnabled = finePointerMedia.matches;
    let rotation = 0;
    let lastTime = performance.now();
    let now = lastTime;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let alive = true;
    let stars: Star[] = [];

    const pointerTarget = { x: 0, y: 0 };
    const pointerCurrent = { x: 0, y: 0 };

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

    const starColorCache = new Map<number, string>();
    const starColorFor = (alpha: number) => {
      const key = Math.round(alpha * 40);
      let c = starColorCache.get(key);
      if (!c) {
        c = `rgba(210, 222, 255, ${(key / 40).toFixed(3)})`;
        starColorCache.set(key, c);
      }
      return c;
    };

    function draw() {
      if (!width || !height) return;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, width, height);

      const size = Math.min(width, height);
      const starShift = size * STAR_PARALLAX_FACTOR;

      for (const star of stars) {
        const flicker = 0.5 + 0.5 * Math.sin(now * 0.001 * star.speed + star.phase);
        const alpha = 0.25 + flicker * 0.55 * star.depth;
        const x = star.x * width + pointerCurrent.x * starShift * star.depth;
        const y = star.y * height + pointerCurrent.y * starShift * star.depth;

        ctx!.fillStyle = starColorFor(alpha);
        ctx!.beginPath();
        ctx!.arc(x, y, star.radius, 0, Math.PI * 2);
        ctx!.fill();
      }

      const points = pointsRef.current;
      if (points.length === 0) return;

      const globeRadius = size * SCALE;
      const cx = width * 0.5;
      const cy = height * CY;
      const centerLon = INITIAL_CENTER_LON + rotation + pointerCurrent.x * MAX_YAW_TILT;
      const pitch = pointerCurrent.y * MAX_PITCH_TILT;
      const cosPitch = Math.cos(pitch);
      const sinPitch = Math.sin(pitch);
      const baseDotRadius = Math.max(0.7, size / 520);

      for (const point of points) {
        const lat = point[0];
        const relLon = point[1] - centerLon;
        const cosLat = Math.cos(lat);

        const flatY = Math.sin(lat);
        const flatZ = cosLat * Math.cos(relLon);
        // Pitch the whole sphere toward the cursor (rotate around the X-axis).
        const sphereY = flatY * cosPitch - flatZ * sinPitch;
        const sphereZ = flatY * sinPitch + flatZ * cosPitch;
        if (sphereZ <= 0.02) continue; // behind the horizon

        const sphereX = cosLat * Math.sin(relLon);

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
      if (stars.length === 0) stars = makeStars(width, height);
      draw();
    }

    function frame(t: number) {
      const dt = Math.min(0.05, (t - lastTime) / 1000);
      lastTime = t;
      now = t;
      if (!paused && !document.hidden) {
        rotation += RADIANS_PER_SECOND * speedMultiplier * dt;
        if (pointerEnabled) {
          const ease = 1 - Math.exp(-dt * POINTER_EASE_PER_SECOND);
          pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * ease;
          pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * ease;
        }
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
    const onPointerCapability = (e: MediaQueryListEvent) => {
      pointerEnabled = e.matches;
      if (!pointerEnabled) {
        pointerTarget.x = 0;
        pointerTarget.y = 0;
      }
    };
    const onVisible = () => {
      lastTime = performance.now();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!pointerEnabled) return;
      pointerTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerTarget.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onPointerRecenter = () => {
      pointerTarget.x = 0;
      pointerTarget.y = 0;
    };

    media.addEventListener("change", onMotion);
    mobileMedia.addEventListener("change", onViewport);
    finePointerMedia.addEventListener("change", onPointerCapability);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("blur", onPointerRecenter);
    document.addEventListener("mouseleave", onPointerRecenter);
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
      finePointerMedia.removeEventListener("change", onPointerCapability);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("blur", onPointerRecenter);
      document.removeEventListener("mouseleave", onPointerRecenter);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
