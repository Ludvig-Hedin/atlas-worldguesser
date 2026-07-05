"use client";

import { useEffect, useState } from "react";

/**
 * Captures `window.innerHeight` once on mount and never updates it. Mobile
 * browsers resize the layout viewport as their address bar shows/hides on
 * scroll — anything sized off a live viewport unit (`dvh`, `vh`, or a fixed
 * element pinned with `inset-0`) visibly resizes as a result. Returns
 * `undefined` on the server/first paint so callers can fall back to a CSS
 * viewport unit until this resolves.
 */
export function useLockedViewportHeight(): number | undefined {
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    setHeight(window.innerHeight);
  }, []);

  return height;
}
