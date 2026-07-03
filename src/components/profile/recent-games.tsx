"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MapGlyph } from "@/components/map-glyph";
import { Badge } from "@/components/ui/badge";
import { formatNumber, timeAgo } from "@/lib/format";
import { getMapConfig, mapNameKey } from "@/lib/maps-config";
import { useT } from "@/hooks/use-t";
import { cn } from "@/lib/utils";

export interface RecentItem {
  key: string;
  mapId: string;
  mode?: "solo" | "multi";
  totalScore: number;
  maxScore: number;
  won: boolean;
  at: number;
  replayId?: string;
}

export function RecentGames({ games }: { games: RecentItem[] }) {
  const t = useT();
  if (games.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        {t("profile.noRecentGames")}
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {games.map((g) => {
        const map = getMapConfig(g.mapId);
        const pct = g.maxScore > 0 ? Math.round((g.totalScore / g.maxScore) * 100) : 0;
        const inner = (
          <div className="flex items-center gap-3 px-4 py-3">
            <MapGlyph mapId={g.mapId} className="size-5 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{t(mapNameKey(map.id))}</span>
                {g.mode === "multi" && <Badge variant="muted">{t("common.multiplayer")}</Badge>}
                {g.won && <Badge variant="primary">{t("common.win")}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{timeAgo(g.at)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular">{formatNumber(g.totalScore)}</p>
              <p className="text-xs text-muted-foreground">{pct}%</p>
            </div>
            {g.replayId && <ChevronRight className="size-4 text-subtle" />}
          </div>
        );
        return g.replayId ? (
          <Link key={g.key} href={`/replay/${g.replayId}`} className="transition-colors hover:bg-elevated">
            {inner}
          </Link>
        ) : (
          <div key={g.key} className={cn(g.replayId && "cursor-pointer")}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
