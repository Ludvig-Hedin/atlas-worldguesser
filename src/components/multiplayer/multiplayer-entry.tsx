"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Authenticated, Unauthenticated, useMutation } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { toast } from "sonner";
import { ArrowRight, Users } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
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

export function MultiplayerEntry() {
  if (!features.multiplayer) return null;
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card/60 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Users className="size-4 text-primary-muted" />
        <h3 className="text-sm font-semibold">Play with friends</h3>
      </div>
      <Authenticated>
        <MultiplayerControls />
      </Authenticated>
      <Unauthenticated>
        <SignInButton mode="modal">
          <Button className="w-full" variant="secondary">
            Sign in for multiplayer
          </Button>
        </SignInButton>
      </Unauthenticated>
    </div>
  );
}

function MultiplayerControls() {
  const router = useRouter();
  const create = useMutation(api.rooms.create);
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);

  const createRoom = async () => {
    setCreating(true);
    try {
      const { code: newCode } = await create({ mapId: "world", settings: DEFAULT_SETTINGS });
      router.push(`/room/${newCode}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create room");
      setCreating(false);
    }
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeRoomInput(code);
    if (clean.length < 4) return;
    router.push(`/room/${clean}`);
  };

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={createRoom} disabled={creating}>
        Create private room
        <ArrowRight className="size-4" />
      </Button>
      <div className="flex items-center gap-2 text-xs text-subtle">
        <span className="h-px flex-1 bg-border" />
        or join
        <span className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={joinRoom} className="flex items-center gap-2">
        <input
          value={code}
          onChange={(e) => setCode(normalizeRoomInput(e.target.value))}
          placeholder="Room code or link"
          className="h-10 flex-1 rounded-lg border border-border bg-input px-3 text-center font-mono text-sm tracking-widest outline-none placeholder:tracking-normal placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" variant="secondary" disabled={code.length < 4}>
          Join
        </Button>
      </form>
    </div>
  );
}
