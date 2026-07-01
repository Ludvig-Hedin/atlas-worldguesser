"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Countdown to a wall-clock deadline (ms epoch), server-authoritative safe.
 * Returns remaining seconds; fires `onExpire` once when it reaches zero.
 * Pass `null` to disable (untimed rounds).
 */
export function useCountdown(deadline: number | null, onExpire?: () => void) {
  const [remaining, setRemaining] = useState(() =>
    deadline ? Math.max(0, (deadline - Date.now()) / 1000) : 0,
  );
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    firedRef.current = false;
    if (!deadline) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      const r = Math.max(0, (deadline - Date.now()) / 1000);
      setRemaining(r);
      if (r <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current?.();
      }
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [deadline]);

  return remaining;
}
