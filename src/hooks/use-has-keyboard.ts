"use client";

import { useEffect, useState } from "react";

/**
 * True once we're reasonably confident the user has a physical keyboard:
 * the primary pointer is fine (mouse/trackpad, not touch), or a real key
 * press has been observed (covers touch devices with an external/on-screen
 * keyboard). Starts `false` to match SSR and avoid a shown-then-hidden
 * flash of shortcut hints on touch-only devices.
 */
export function useHasKeyboard(): boolean {
  const [hasKeyboard, setHasKeyboard] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) {
      setHasKeyboard(true);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Unidentified") return;
      setHasKeyboard(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return hasKeyboard;
}
