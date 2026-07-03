"use client";

import { useEffect, useRef, useState } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import { guestImportPayload, hasGuestProgress, loadProfile } from "@/lib/local-profile";

/** localStorage flag so the guest→cloud import is attempted at most once per device. */
const IMPORT_FLAG = "atlas:guest-imported:v1";

/**
 * Idempotently provisions the signed-in user in Convex once auth is ready, then
 * performs a one-time import of any on-device guest progress into the (fresh)
 * cloud account so signing in never feels like it wiped the player's stats.
 */
export function EnsureUser() {
  const { isAuthenticated } = useConvexAuth();
  const ensureUser = useMutation(api.users.ensureUser);
  const importGuest = useMutation(api.users.importGuestProfile);
  const done = useRef(false);
  // Bump to re-run the effect after a failed attempt — nothing else in the
  // deps changes while signed in, so without this a failure would only be
  // retried on a full page reload.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || done.current) return;
    done.current = true;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        await ensureUser({});
      } catch {
        done.current = false;
        if (!cancelled && attempt < 3) {
          retryTimer = setTimeout(() => setAttempt((a) => a + 1), 3000 * (attempt + 1));
        }
        return;
      }

      // One-time guest import (runs after provisioning so requireUser succeeds).
      try {
        if (typeof window === "undefined") return;
        if (window.localStorage.getItem(IMPORT_FLAG)) return;
        const profile = loadProfile();
        if (!hasGuestProgress(profile)) {
          window.localStorage.setItem(IMPORT_FLAG, "1");
          return;
        }
        const res = await importGuest(guestImportPayload(profile));
        window.localStorage.setItem(IMPORT_FLAG, "1");
        if (res?.merged) {
          toast.success("Welcome back — your guest progress was saved to your account.");
        }
      } catch {
        // Non-fatal: flag isn't set on throw, so it retries on a future load.
      }
    })();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [isAuthenticated, ensureUser, importGuest, attempt]);

  return null;
}
