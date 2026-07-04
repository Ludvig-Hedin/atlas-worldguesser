"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { getClientId } from "@/lib/client-id";
import { features } from "@/lib/env";

/**
 * localStorage keys — deliberately DISTINCT from presence's `atlas.sid`. A guest
 * identity is a real FK-bearing (ephemeral) account, so it must not inherit the
 * presence session's rotation/pruning semantics.
 */
const GUEST_ID_KEY = "atlas.guestId";
const GUEST_MODE_KEY = "atlas.guestMode";

type GuestSession = {
  /** Stable device id used as the guest account's FK; null before mount. */
  guestId: string | null;
  /** The visitor has opted into guest mode (persisted across reloads). */
  guestActive: boolean;
  /** The guest `users` row is provisioned server-side (safe to join/play). */
  guestReady: boolean;
  /** Opt into guest mode (persists the choice) and start provisioning. */
  enableGuest: () => void;
  /** Idempotently ensure the guest row exists; resolves once it is ready. */
  provisionGuest: () => Promise<void>;
};

const noopAsync = async () => {};

const GuestContext = createContext<GuestSession>({
  guestId: null,
  guestActive: false,
  guestReady: false,
  enableGuest: () => {},
  provisionGuest: noopAsync,
});

export function useGuestSession(): GuestSession {
  return useContext(GuestContext);
}

/** Convenience accessor: the guest id (null before mount / when unavailable). */
export function useGuestId(): string | null {
  return useContext(GuestContext).guestId;
}

/**
 * Gives a signed-out visitor an ephemeral guest identity so they can play
 * realtime multiplayer with full parity. A guest is a real (but ephemeral)
 * `users` row keyed by a client-generated id; Clerk identity always takes
 * precedence server-side, so this never touches the signed-in experience.
 * Mounted inside ConvexProviderWithClerk so it can read auth state and call
 * the `ensureGuestUser` mutation.
 */
export function GuestSessionProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const ensureGuestUser = useMutation(api.users.ensureGuestUser);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestActive, setGuestActive] = useState(false);
  const [guestReady, setGuestReady] = useState(false);
  // Cache the in-flight provision so concurrent callers share one request.
  const provisionRef = useRef<Promise<void> | null>(null);

  // Resolve the stable guest id + any persisted opt-in on the client only.
  useEffect(() => {
    setGuestId(getClientId(GUEST_ID_KEY));
    try {
      if (localStorage.getItem(GUEST_MODE_KEY) === "1") setGuestActive(true);
    } catch {
      /* storage blocked — guest mode simply won't persist */
    }
  }, []);

  const provisionGuest = useCallback(async (): Promise<void> => {
    // Signed-in users are provisioned by EnsureUser; the guest id is never used
    // for them (Clerk wins server-side), so there is nothing to do.
    // TODO(bug-hunt): `isAuthenticated` has no isLoading guard, same family as
    // the match-results.tsx sign-in-flicker fix. A signed-in user landing
    // directly on /room/CODE (e.g. an invite link) before Convex resolves the
    // Clerk JWT can trip this check and provision a redundant ephemeral guest
    // row for an already-authed account. Harmless server-side (Clerk identity
    // wins there) but wastes a mutation call + DB row on every such race.
    if (isAuthenticated || !features.convex) return;
    if (!guestId || guestReady) return;
    if (!provisionRef.current) {
      provisionRef.current = ensureGuestUser({ guestId })
        .then(() => {
          setGuestReady(true);
        })
        .catch((err) => {
          // Clear the cache so a later button click / effect re-run can retry.
          provisionRef.current = null;
          throw err;
        });
    }
    await provisionRef.current;
  }, [isAuthenticated, guestId, guestReady, ensureGuestUser]);

  const enableGuest = useCallback(() => {
    setGuestActive(true);
    try {
      localStorage.setItem(GUEST_MODE_KEY, "1");
    } catch {
      /* non-persistent guest mode for this load only */
    }
  }, []);

  // Auto-provision once a guest has opted in and is not signed in, so arriving
  // at /room/CODE (e.g. from an invite link) "just works" without another click.
  useEffect(() => {
    if (!guestActive || isAuthenticated) return;
    void provisionGuest().catch(() => {});
  }, [guestActive, isAuthenticated, provisionGuest]);

  return (
    <GuestContext.Provider
      value={{ guestId, guestActive, guestReady, enableGuest, provisionGuest }}
    >
      {children}
    </GuestContext.Provider>
  );
}
