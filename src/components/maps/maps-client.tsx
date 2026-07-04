"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Authenticated, useConvexAuth, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Heart, Play, Plus, Trash2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/components/ui/segmented";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/use-t";

type Sort = "likes" | "newest" | "plays";

interface MapSummary {
  _id: Id<"maps">;
  name: string;
  description?: string;
  ownerName: string;
  isPublic: boolean;
  locationCount: number;
  plays: number;
  likes: number;
  createdAt: number;
}

function LikeButton({
  liked,
  likes,
  pending,
  canLike,
  onToggle,
}: {
  liked: boolean;
  likes: number;
  pending: boolean;
  canLike: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onToggle}
      disabled={!canLike || pending}
      aria-label={liked ? t("maps.unlikeMap") : t("maps.likeMap")}
      aria-pressed={liked}
      className={cn("gap-1.5 px-3", liked && "border-destructive/40 text-destructive")}
    >
      <Heart className={cn("size-3.5", liked && "fill-current")} />
      <span className="tabular">{likes}</span>
    </Button>
  );
}

function MapCard({
  map,
  onDelete,
  deleting,
  liked,
  likePending,
  canLike,
  onToggleLike,
}: {
  map: MapSummary;
  onDelete?: () => void;
  deleting?: boolean;
  liked: boolean;
  likePending: boolean;
  canLike: boolean;
  onToggleLike: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{map.name}</h3>
          <p className="text-xs text-muted-foreground">
            {t("maps.byAuthor", { author: map.ownerName })} · {pluralize(map.locationCount, "location")} ·{" "}
            {pluralize(map.plays, "play")}
          </p>
        </div>
        {!map.isPublic && <Badge variant="muted">{t("maps.private")}</Badge>}
      </div>
      {map.description && <p className="line-clamp-2 text-sm text-muted-foreground">{map.description}</p>}
      <div className="mt-auto flex items-center gap-2">
        <Button size="sm" asChild className="flex-1">
          <Link href={`/maps/${map._id}/play`}>
            <Play className="size-3.5" />
            {t("maps.play")}
          </Link>
        </Button>
        <LikeButton liked={liked} likes={map.likes} pending={likePending} canLike={canLike} onToggle={onToggleLike} />
        {onDelete && (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onDelete}
            disabled={deleting}
            aria-label={t("maps.deleteMap")}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function MapsClient() {
  const t = useT();
  const { isAuthenticated } = useConvexAuth();
  const [sort, setSort] = useState<Sort>("likes");
  const publicMaps = useQuery(api.maps.listPublic, { sort });
  const mine = useQuery(api.maps.listMine);
  const likedIds = useQuery(api.maps.myLikedMapIds);
  const remove = useMutation(api.maps.remove);
  const toggleLike = useMutation(api.maps.toggleLike);
  const [deleteTarget, setDeleteTarget] = useState<Id<"maps"> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [likePending, setLikePending] = useState<Set<Id<"maps">>>(new Set());

  const likedSet = useMemo(() => new Set(likedIds ?? []), [likedIds]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await remove({ mapId: deleteTarget });
      toast(t("maps.mapDeleted"));
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("maps.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleLike = async (mapId: Id<"maps">) => {
    if (likePending.has(mapId)) return;
    setLikePending((prev) => new Set(prev).add(mapId));
    try {
      await toggleLike({ mapId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("maps.deleteFailed"));
    } finally {
      setLikePending((prev) => {
        const next = new Set(prev);
        next.delete(mapId);
        return next;
      });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("maps.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("maps.subtitle")}</p>
        </div>
        <Authenticated>
          <Button asChild>
            <Link href="/maps/new">
              <Plus className="size-4" />
              {t("maps.create")}
            </Link>
          </Button>
        </Authenticated>
      </div>

      <Authenticated>
        {mine && mine.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">{t("maps.yourMaps")}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((m) => (
                <MapCard
                  key={m._id}
                  map={m}
                  onDelete={() => setDeleteTarget(m._id)}
                  deleting={deleting && deleteTarget === m._id}
                  liked={likedSet.has(m._id)}
                  likePending={likePending.has(m._id)}
                  canLike={isAuthenticated}
                  onToggleLike={() => handleToggleLike(m._id)}
                />
              ))}
            </div>
          </section>
        )}
      </Authenticated>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">{t("maps.communityMaps")}</h2>
          <Segmented
            className="sm:w-auto"
            options={[
              { value: "likes", label: t("maps.sortTrending") },
              { value: "newest", label: t("maps.sortNewest") },
              { value: "plays", label: t("maps.sortMostPlayed") },
            ]}
            value={sort}
            onChange={setSort}
            size="sm"
            ariaLabel={t("maps.sortAria")}
          />
        </div>
        {publicMaps === undefined ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : publicMaps.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            {t("maps.noCommunityMaps")}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {publicMaps.map((m) => (
              <MapCard
                key={m._id}
                map={m}
                liked={likedSet.has(m._id)}
                likePending={likePending.has(m._id)}
                canLike={isAuthenticated}
                onToggleLike={() => handleToggleLike(m._id)}
              />
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o && !deleting) setDeleteTarget(null);
        }}
        title={t("maps.deleteDialogTitle")}
        description={t("maps.deleteDialogDescription")}
        confirmLabel={t("maps.deleteConfirm")}
        destructive
        pending={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
