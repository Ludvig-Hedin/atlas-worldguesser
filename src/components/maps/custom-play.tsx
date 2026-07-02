"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { Globe2, Loader2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { SoloGame } from "@/components/game/solo-game";
import { Button } from "@/components/ui/button";
import { DEFAULT_SETTINGS } from "@/lib/maps-config";

export function CustomPlay({ mapId }: { mapId: string }) {
  const router = useRouter();
  const data = useQuery(api.maps.getWithLocations, { mapId: mapId as Id<"maps"> });

  if (data === undefined) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-black">
        <Loader2 className="size-6 animate-spin text-primary-muted" />
      </div>
    );
  }
  if (data === null || data.locations.length < 5) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 text-center">
        <Globe2 className="size-8 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Map unavailable</h1>
        <p className="text-sm text-muted-foreground">This map is private or doesn&apos;t have enough locations.</p>
        <Button asChild>
          <Link href="/maps">Browse maps</Link>
        </Button>
      </div>
    );
  }

  return (
    <SoloGame
      mapId="custom"
      settings={DEFAULT_SETTINGS}
      customLocations={data.locations}
      onExit={() => router.push("/maps")}
    />
  );
}
