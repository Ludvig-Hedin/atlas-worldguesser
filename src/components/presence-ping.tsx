"use client";

import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { features } from "@/lib/env";

const PING_INTERVAL_MS = 45_000;
const STORAGE_KEY = "atlas.sid";

function getSessionId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    // Private mode / storage blocked — fall back to a volatile per-load id.
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Invisible heartbeat: records this tab in the presence table so the homepage
 * "X playing now" count reflects real activity (guests included). Pings on mount
 * and every ~45s while the tab is visible. No UI. Only active when Convex is
 * configured; safe to mount globally.
 */
export function PresencePing() {
  const ping = useMutation(api.presence.ping);

  useEffect(() => {
    if (!features.convex) return;
    const sessionId = getSessionId();
    let cancelled = false;

    const beat = () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      void ping({ sessionId }).catch(() => {
        /* fire-and-forget — a dropped heartbeat just ages out */
      });
    };

    beat();
    const timer = setInterval(beat, PING_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ping]);

  return null;
}
