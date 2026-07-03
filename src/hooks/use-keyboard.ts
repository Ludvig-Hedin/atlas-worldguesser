"use client";

import { useEffect, useRef } from "react";

type KeyHandler = (event: KeyboardEvent) => void;

/**
 * Register global keyboard shortcuts, keyed by `event.key` (case-insensitive).
 * Ignores keystrokes originating from inputs/textareas/contenteditable.
 */
export function useKeyboardShortcuts(
  handlers: Record<string, KeyHandler>,
  enabled = true,
) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      // Lowercase ALL keys (not just single chars) so handlers registered as
      // "enter" match e.key === "Enter" — the docstring promises case-insensitivity.
      const key = e.key.toLowerCase();
      const handler = handlersRef.current[key] ?? handlersRef.current[e.key];
      if (handler) handler(e);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
