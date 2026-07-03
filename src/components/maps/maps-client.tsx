"use client";

import { useState } from "react";
import Link from "next/link";
import { Authenticated, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Play, Plus, Trash2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { pluralize, timeAgo } from "@/lib/format";

interface MapSummary {
  _id: Id<"maps">;
  name: string;
  description?: string;
  ownerName: string;
  isPublic: boolean;
  locationCount: number;
  createdAt: number;
}

function MapCard({
  map,
  onDelete,
  deleting,
}: {
  map: MapSummary;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{map.name}</h3>
          <p className="text-xs text-muted-foreground">
            by {map.ownerName} · {pluralize(map.locationCount, "location")}
          </p>
        </div>
        {!map.isPublic && <Badge variant="muted">Private</Badge>}
      </div>
      {map.description && <p className="line-clamp-2 text-sm text-muted-foreground">{map.description}</p>}
      <div className="mt-auto flex items-center gap-2">
        <Button size="sm" asChild className="flex-1">
          <Link href={`/maps/${map._id}/play`}>
            <Play className="size-3.5" />
            Play
          </Link>
        </Button>
        {onDelete && (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onDelete}
            disabled={deleting}
            aria-label="Delete map"
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function MapsClient() {
  const publicMaps = useQuery(api.maps.listPublic);
  const mine = useQuery(api.maps.listMine);
  const remove = useMutation(api.maps.remove);
  const [deleteTarget, setDeleteTarget] = useState<Id<"maps"> | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await remove({ mapId: deleteTarget });
      toast("Map deleted");
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete map");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Custom maps</h1>
          <p className="mt-1 text-sm text-muted-foreground">Play community maps or craft your own</p>
        </div>
        <Authenticated>
          <Button asChild>
            <Link href="/maps/new">
              <Plus className="size-4" />
              Create
            </Link>
          </Button>
        </Authenticated>
      </div>

      <Authenticated>
        {mine && mine.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">Your maps</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((m) => (
                <MapCard
                  key={m._id}
                  map={m}
                  onDelete={() => setDeleteTarget(m._id)}
                  deleting={deleting && deleteTarget === m._id}
                />
              ))}
            </div>
          </section>
        )}
      </Authenticated>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Community maps</h2>
        {publicMaps === undefined ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : publicMaps.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            No community maps yet — be the first to create one.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {publicMaps.map((m) => (
              <MapCard key={m._id} map={m} />
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o && !deleting) setDeleteTarget(null);
        }}
        title="Delete map?"
        description="This permanently deletes this map and its locations. This can't be undone."
        confirmLabel="Delete"
        destructive
        pending={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
