"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/hooks/use-t";

/**
 * Homepage social proof: a single "N online" pill sourced from a live Convex
 * subscription (presence.homeStats). Renders nothing while loading, and
 * nothing once loaded if nobody is currently playing — no layout shift, no
 * near-zero number ever shown.
 *
 * Only mount this where the Convex provider exists (i.e. behind `features.auth`).
 */
export function LiveStats() {
  const t = useT();
  const stats = useQuery(api.presence.homeStats);

  if (!stats || stats.playingNow < 1) return null;

  return (
    <Badge
      variant="muted"
      className="gap-1.5 border border-border bg-overlay backdrop-blur-sm"
    >
      <span className="relative flex size-2" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/70" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
      </span>
      {t("home.online", { count: stats.playingNow.toLocaleString() })}
    </Badge>
  );
}
