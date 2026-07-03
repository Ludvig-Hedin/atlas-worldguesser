"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  durationMs?: number;
  format?: (n: number) => string;
  className?: string;
}

/** Eased count-up to `value`, animating from the previous value on change. */
export function AnimatedNumber({ value, durationMs = 700, format, className }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (value - from) * eased;
      // Keep the origin at the live displayed value so a mid-animation value
      // change restarts from what's on screen instead of jumping backwards.
      fromRef.current = current;
      setDisplay(current);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <span className={className}>{format ? format(display) : Math.round(display).toString()}</span>;
}
