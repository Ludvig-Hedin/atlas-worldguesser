"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Authenticated, Unauthenticated, useConvexAuth, useMutation } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { toast } from "sonner";
import { ArrowRight, Loader2, Users } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useGuestSession } from "@/components/guest/guest-session-provider";
import { useT } from "@/hooks/use-t";
import { DEFAULT_SETTINGS } from "@/lib/maps-config";
import { features } from "@/lib/env";

/**
 * Accepts either a raw room code or a full invite link (e.g. `https://site/room/ABCD`)
 * and returns a normalized code: uppercase, alphanumeric, max 6 chars.
 */
function normalizeRoomInput(raw: string): string {
  const linkMatch = raw.match(/\/room\/([A-Za-z0-9]+)/i);
  const base = linkMatch ? linkMatch[1] : raw.replace(/[^A-Za-z0-9]/g, "");
  return base.toUpperCase().slice(0, 6);
}

export function MultiplayerEntry({ startExpanded = false }: { startExpanded?: boolean } = {}) {
  if (!features.multiplayer) return null;
  return (
    <div className="w-full">
      <Authenticated>
        <MultiplayerControls startExpanded={startExpanded} />
      </Authenticated>
      <Unauthenticated>
        <GuestEntry startExpanded={startExpanded} />
      </Unauthenticated>
    </div>
  );
}

/**
 * Signed-out multiplayer entry: once the visitor opts into guest mode they get
 * the full create/join controls (as an ephemeral guest); otherwise they can
 * start as a guest or sign in.
 * TODO(i18n): "Play as guest" is hardcoded English — add an `mp.playAsGuest`
 * key across src/lib/i18n/* once the parallel i18n edits settle.
 */
function GuestEntry({ startExpanded }: { startExpanded?: boolean }) {
  const t = useT();
  const { guestActive, enableGuest } = useGuestSession();
  if (guestActive) return <MultiplayerControls startExpanded={startExpanded} />;
  return (
    <div className="flex flex-col gap-1.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={enableGuest}
        className="gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <Users className="size-3.5" />
        Play as guest
      </Button>
      <SignInButton mode="modal">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          {t("mp.signInForMultiplayer")}
        </Button>
      </SignInButton>
    </div>
  );
}

function MultiplayerControls({ startExpanded = false }: { startExpanded?: boolean }) {
  const t = useT();
  const router = useRouter();
  const create = useMutation(api.rooms.create);
  const { guestId, provisionGuest } = useGuestSession();
  const { isAuthenticated } = useConvexAuth();
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState<"room" | "duel" | null>(null);
  const [expanded, setExpanded] = useState(startExpanded);

  const createRoom = async () => {
    setCreating("room");
    try {
      // Guests need their ephemeral account row before create() can requireUser.
      if (!isAuthenticated) await provisionGuest();
      const { code: newCode } = await create({
        mapId: "world",
        settings: DEFAULT_SETTINGS,
        guestId: guestId ?? undefined,
      });
      router.push(`/room/${newCode}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("mp.couldNotCreateRoom"));
      setCreating(null);
    }
  };

  const createDuel = async () => {
    setCreating("duel");
    try {
      if (!isAuthenticated) await provisionGuest();
      const { code: newCode } = await create({
        mapId: "world",
        settings: DEFAULT_SETTINGS,
        duelsMode: true,
        guestId: guestId ?? undefined,
      });
      router.push(`/room/${newCode}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("mp.couldNotCreateRoom"));
      setCreating(null);
    }
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeRoomInput(code);
    if (clean.length < 4) return;
    router.push(`/room/${clean}`);
  };

  if (!expanded) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(true)}
        className="gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <Users className="size-3.5" />
        {t("mp.playWithFriends")}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={createRoom} disabled={!!creating}>
        {t("mp.createPrivateRoom")}
        {creating === "room" ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
      </Button>
      <Button variant="secondary" onClick={createDuel} disabled={!!creating}>
        {t("duels.start")}
        {creating === "duel" ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
      </Button>
      <div className="flex items-center gap-2 text-xs text-subtle">
        <span className="h-px flex-1 bg-border" />
        {t("mp.orJoin")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={joinRoom} className="flex items-center gap-2">
        <input
          value={code}
          onChange={(e) => setCode(normalizeRoomInput(e.target.value))}
          placeholder={t("mp.roomCodeOrLink")}
          className="h-10 flex-1 rounded-lg border border-border bg-input px-3 text-center font-mono text-sm tracking-widest outline-none transition-colors placeholder:tracking-normal placeholder:text-subtle hover:border-border-strong focus-visible:border-ring"
        />
        <Button type="submit" variant="secondary" disabled={code.length < 4}>
          {t("common.join")}
        </Button>
      </form>
      <Button variant="ghost" size="sm" asChild className="mt-1">
        <Link href="/party">
          <Users className="size-4" />
          {t("mp.playWithParty")}
        </Link>
      </Button>
    </div>
  );
}
