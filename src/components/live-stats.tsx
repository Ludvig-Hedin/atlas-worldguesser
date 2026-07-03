"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/hooks/use-t";

/**
 * Homepage social proof: a live "X playing now" pill and a total-players badge.
 * Both come from a single Convex subscription (presence.homeStats). The live
 * pill shows only when someone is active; the total badge stays hidden until it
 * reaches 100 so an early, small number is never on display. Renders nothing
 * while loading — no layout shift.
 *
 * Only mount this where the Convex provider exists (i.e. behind `features.auth`).
 */
export function LiveStats() {
  const t = useT();
  const stats = useQuery(api.presence.homeStats);

  if (!stats) return null;

  const showPlaying = stats.playingNow >= 1;
  const showTotal = stats.totalPlayers >= 100;
  if (!showPlaying && !showTotal) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
      {showPlaying && (
        <Badge
          variant="muted"
          className="gap-1.5 border border-border bg-overlay backdrop-blur-sm"
        >
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/70" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          {t("home.playingNow", { count: stats.playingNow.toLocaleString() })}
        </Badge>
      )}
      {showTotal && (
        <Badge
          variant="muted"
          className="border border-border bg-overlay backdrop-blur-sm"
        >
          {t("home.players", { count: stats.totalPlayers.toLocaleString() })}
        </Badge>
      )}
    </div>
  );
}
