"use client";

import { useEffect, useRef, useState } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { FlagGameMode, FlagRegionId } from "@/lib/flags/regions";

const MAX_ATTEMPTS = 3;

/**
 * Mirror a finished Flags run to the signed-in user's cloud profile (XP + best
 * board). Rendered only where Convex is configured; a no-op for guests. Retries
 * with backoff so a dropped connection at the finish doesn't lose the result.
 * Mirrors SoloCloudSync's synchronous-claim / retry discipline.
 */
export function FlagCloudSync({
  region,
  mode,
  perFlagWrong,
}: {
  region: FlagRegionId;
  mode: FlagGameMode;
  perFlagWrong: number[];
}) {
  const { isAuthenticated } = useConvexAuth();
  const submit = useMutation(api.flags.submit);
  const done = useRef(false);
  const [attempt, setAttempt] = useState(0);

  // TODO(bug-hunt): same "pending retry stranded on unmount" tradeoff already
  // tracked for solo-cloud-sync.tsx in CODE_REVIEW_BACKLOG.md — navigating
  // away while a 2s/4s backoff retry is pending drops this Flags result
  // silently (cleanup clears the timer, nothing resumes it). Same accepted
  // architectural gap, now duplicated here.
  useEffect(() => {
    if (!isAuthenticated || done.current) return;
    // Claim synchronously so a re-entrant effect run (StrictMode remount, or
    // `submit` identity changing mid-flight) can't double-submit — the server
    // has no idempotency check and would double-count XP.
    done.current = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    submit({ region, mode, perFlagWrong }).catch(() => {
      if (attempt < MAX_ATTEMPTS - 1) {
        done.current = false;
        retryTimer = setTimeout(() => setAttempt((a) => a + 1), 2000 * (attempt + 1));
      } else {
        toast.error("Couldn't save this run to your profile. Check your connection.");
      }
    });

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [isAuthenticated, submit, region, mode, perFlagWrong, attempt]);

  return null;
}
