"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// One rotation roughly every 50s on desktop. Mobile spins faster (see multiplier).
const RADIANS_PER_SECOND = (Math.PI * 2) / 50;
// Phones get a livelier spin — the globe is smaller there, so faster reads well.
const MOBILE_SPEED_MULTIPLIER = 1.7; // → ~30s per rotation on small viewports
const INITIAL_CENTER_LON = (-30 * Math.PI) / 180;
const SCALE = 0.44; // globe radius as fraction of min(viewport w, h) — whole Earth, uncropped
const CY = 0.5; // vertical center as fraction of height

// Drag-to-spin — grabbing the globe rotates/tilts it directly (1:1 with the
// pointer, like spinning a desk globe); releasing keeps the flung momentum.
const MAX_DRAG_PITCH = 1.1; // clamp so the globe can't flip past its pole (rad)
const PITCH_SPRING_BACK_PER_SECOND = 2.2; // tilt eases back to level once released
const YAW_FLING_DECAY_PER_SECOND = 1.8; // exponential decay of released spin momentum

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
 * pauses when the tab is hidden or reduced-motion is requested. Draggable with
 * a mouse to spin/tilt it directly; aria-hidden since it's decorative.
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
    // Drag-to-spin follows a real mouse only — ignore touch so scrolling on
    // mobile never gets hijacked by the fixed background canvas.
    const finePointerMedia = window.matchMedia("(pointer: fine)");
    let dragEnabled = finePointerMedia.matches;
    let rotation = 0;
    let pitch = 0; // persistent manual tilt from dragging, eases back to 0 when released
    let dragging = false;
    let dragPointerId: number | null = null;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let lastMoveTime = 0;
    let yawVelocity = 0; // rad/s — residual spin momentum after release
    let lastTime = performance.now();
    let now = lastTime;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let alive = true;
    let stars: Star[] = [];

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

      for (const star of stars) {
        const flicker = 0.5 + 0.5 * Math.sin(now * 0.001 * star.speed + star.phase);
        const alpha = 0.25 + flicker * 0.55 * star.depth;
        const x = star.x * width;
        const y = star.y * height;

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
      const centerLon = INITIAL_CENTER_LON + rotation;
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
        if (yawVelocity !== 0) {
          rotation += yawVelocity * dt;
          yawVelocity *= Math.exp(-YAW_FLING_DECAY_PER_SECOND * dt);
          if (Math.abs(yawVelocity) < 0.001) yawVelocity = 0;
        }
        if (!dragging && pitch !== 0) {
          const ease = 1 - Math.exp(-dt * PITCH_SPRING_BACK_PER_SECOND);
          pitch -= pitch * ease;
          if (Math.abs(pitch) < 0.0005) pitch = 0;
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
      dragEnabled = e.matches;
    };
    const onVisible = () => {
      lastTime = performance.now();
    };

    // Grab-and-spin: only mouse drags rotate the globe, so touch scrolling
    // over the fixed background canvas is never hijacked.
    const onPointerDown = (e: PointerEvent) => {
      if (!dragEnabled || e.pointerType !== "mouse" || e.button !== 0) return;
      dragging = true;
      dragPointerId = e.pointerId;
      yawVelocity = 0;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      lastMoveTime = performance.now();
      canvas!.setPointerCapture(e.pointerId);
      canvas!.style.cursor = "grabbing";
      e.preventDefault();
    };
    const onPointerMoveDrag = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== dragPointerId) return;
      const t = performance.now();
      const dt = Math.max(0.001, (t - lastMoveTime) / 1000);
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      const radius = Math.max(1, Math.min(width, height) * SCALE);
      const deltaYaw = -(dx / radius);
      rotation += deltaYaw;
      yawVelocity = deltaYaw / dt;
      pitch = Math.min(MAX_DRAG_PITCH, Math.max(-MAX_DRAG_PITCH, pitch + dy / radius));
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      lastMoveTime = t;
      draw();
    };
    const endDrag = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== dragPointerId) return;
      dragging = false;
      dragPointerId = null;
      canvas!.style.cursor = "grab";
      if (canvas!.hasPointerCapture(e.pointerId)) canvas!.releasePointerCapture(e.pointerId);
    };

    media.addEventListener("change", onMotion);
    mobileMedia.addEventListener("change", onViewport);
    finePointerMedia.addEventListener("change", onPointerCapability);
    document.addEventListener("visibilitychange", onVisible);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMoveDrag);
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
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
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMoveDrag);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={cn("cursor-grab", className)} />;
}
