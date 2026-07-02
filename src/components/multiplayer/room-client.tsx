"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { Globe2, Loader2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import { RoomLobby } from "./room-lobby";
import { RoomGame } from "./room-game";
import { RoomResults } from "./room-results";
import { Button } from "@/components/ui/button";

function FullscreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      {children}
    </div>
  );
}

function RoomInner({ code }: { code: string }) {
  const room = useQuery(api.rooms.getByCode, { code });
  const join = useMutation(api.rooms.join);
  const heartbeat = useMutation(api.rooms.heartbeat);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (room && !room.amMember && room.status === "lobby" && !joinedRef.current) {
      joinedRef.current = true;
      join({ code }).catch(() => {});
    }
  }, [room, join, code]);

  useEffect(() => {
    if (!room?._id) return;
    const id = window.setInterval(() => heartbeat({ roomId: room._id }).catch(() => {}), 15000);
    return () => window.clearInterval(id);
  }, [room?._id, heartbeat]);

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

  if (room.status === "lobby") return <RoomLobby room={room} />;
  if (room.status === "finished") return <RoomResults room={room} />;
  return <RoomGame room={room} />;
}

export function RoomClient({ code }: { code: string }) {
  return (
    <>
      <AuthLoading>
        <FullscreenMessage>
          <Loader2 className="size-6 animate-spin text-primary-muted" />
        </FullscreenMessage>
      </AuthLoading>
      <Unauthenticated>
        <FullscreenMessage>
          <Globe2 className="size-8 text-primary-muted" />
          <h1 className="text-xl font-semibold">Join the match</h1>
          <p className="max-w-xs text-sm text-muted-foreground">
            Sign in to join room <span className="font-mono font-semibold">{code}</span> and play with friends.
          </p>
          <SignInButton mode="modal">
            <Button size="lg">Sign in to join</Button>
          </SignInButton>
        </FullscreenMessage>
      </Unauthenticated>
      <Authenticated>
        <RoomInner code={code} />
      </Authenticated>
    </>
  );
}
