"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useConvexAuth,
  useMutation,
  useQuery,
} from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { Globe2, Loader2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import { RoomLobby } from "./room-lobby";
import { RoomGame } from "./room-game";
import { RoomResults } from "./room-results";
import { Button } from "@/components/ui/button";
import { useGuestSession } from "@/components/guest/guest-session-provider";
import { features } from "@/lib/env";

function FullscreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      {children}
    </div>
  );
}

function RoomInner({ code }: { code: string }) {
  const { guestId, guestReady, provisionGuest } = useGuestSession();
  const { isAuthenticated } = useConvexAuth();
  const room = useQuery(api.rooms.getByCode, { code, guestId: guestId ?? undefined });
  const join = useMutation(api.rooms.join);
  const heartbeat = useMutation(api.rooms.heartbeat);
  const joinedRef = useRef(false);

  // A guest can only join once their ephemeral account row exists; signed-in
  // users are always ready. Kick off provisioning for guests on mount.
  // TODO(bug-hunt): `isAuthenticated` has no isLoading guard here (this is the
  // highest-traffic call site for the race documented in provisionGuest's own
  // TODO in guest-session-provider.tsx — invite links land users directly on
  // this mount).
  const ready = isAuthenticated || guestReady;
  useEffect(() => {
    if (!isAuthenticated) void provisionGuest().catch(() => {});
  }, [isAuthenticated, provisionGuest]);

  useEffect(() => {
    if (!ready) return;
    if (room && !room.amMember && room.status === "lobby" && !joinedRef.current) {
      // TODO(bug-hunt): `joinedRef.current` is claimed before `join()` even
      // resolves, and its rejection is fully swallowed. A transient failure
      // (network blip, brief server error) permanently strands the user here:
      // the effect never retries (the ref stays true), so the component keeps
      // rendering RoomLobby for a non-member forever with every action
      // silently no-op'ing. Needs a bounded retry (reset the ref on failure,
      // capped) or a visible "couldn't join — retry" affordance instead of
      // silent failure.
      joinedRef.current = true;
      join({ code, guestId: guestId ?? undefined }).catch(() => {});
    }
  }, [ready, room, join, code, guestId]);

  useEffect(() => {
    if (!room?._id) return;
    const id = window.setInterval(
      () => heartbeat({ roomId: room._id, guestId: guestId ?? undefined }).catch(() => {}),
      15000,
    );
    return () => window.clearInterval(id);
  }, [room?._id, heartbeat, guestId]);

  if (room === undefined) {
    return (
      <FullscreenMessage>
        <Loader2 className="size-6 animate-spin text-primary-muted" />
      </FullscreenMessage>
    );
  }
  if (room === null) {
    return (
      <FullscreenMessage>
        <Globe2 className="size-8 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Room not found</h1>
        <p className="text-sm text-muted-foreground">This room doesn&apos;t exist or has closed.</p>
        <Button asChild>
          <Link href="/play">Back to play</Link>
        </Button>
      </FullscreenMessage>
    );
  }

  // Joining is only possible from the lobby — rendering the game UI to a
  // non-member would let them place pins whose submits silently fail.
  if (!room.amMember && room.status !== "lobby" && room.status !== "finished") {
    return (
      <FullscreenMessage>
        <Globe2 className="size-8 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Match in progress</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          This match has already started — ask the host for a rematch invite once it ends.
        </p>
        <Button asChild>
          <Link href="/play">Back to play</Link>
        </Button>
      </FullscreenMessage>
    );
  }

  if (room.status === "lobby") return <RoomLobby room={room} />;
  if (room.status === "finished") return <RoomResults room={room} />;
  return <RoomGame room={room} />;
}

export function RoomClient({ code }: { code: string }) {
  if (!features.multiplayer) {
    return (
      <FullscreenMessage>
        <Globe2 className="size-8 text-primary-muted" />
        <h1 className="text-xl font-semibold">Multiplayer is disabled</h1>
        <p className="max-w-xs text-sm text-muted-foreground">Private rooms are currently turned off.</p>
        <Button asChild>
          <Link href="/play">Play solo</Link>
        </Button>
      </FullscreenMessage>
    );
  }
  return (
    <>
      <AuthLoading>
        <FullscreenMessage>
          <Loader2 className="size-6 animate-spin text-primary-muted" />
        </FullscreenMessage>
      </AuthLoading>
      <Unauthenticated>
        <GuestGate code={code} />
      </Unauthenticated>
      <Authenticated>
        <RoomInner code={code} />
      </Authenticated>
    </>
  );
}

/**
 * Signed-out entry to a room: offers signing in (to save stats) or jumping in
 * as an ephemeral guest. Once the visitor has opted into guest mode the gate
 * renders the room directly — the provider auto-provisions the guest account —
 * so returning from an invite link never re-prompts.
 */
function GuestGate({ code }: { code: string }) {
  const { guestActive, enableGuest } = useGuestSession();
  if (guestActive) return <RoomInner code={code} />;
  return (
    <FullscreenMessage>
      <Globe2 className="size-8 text-primary-muted" />
      <h1 className="text-xl font-semibold">Join the match</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        Jump into room <span className="font-mono font-semibold">{code}</span> as a guest, or sign
        in to save your stats and XP.
      </p>
      <div className="flex flex-col items-center gap-2">
        <Button size="lg" onClick={enableGuest}>
          Play as guest
        </Button>
        <SignInButton mode="modal">
          <Button variant="ghost" size="sm">
            Sign in to join
          </Button>
        </SignInButton>
      </div>
    </FullscreenMessage>
  );
}
