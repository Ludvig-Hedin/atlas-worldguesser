"use client";

import { useState } from "react";
import { MatchMap } from "@/components/game/match-map";
import { GuessMap } from "@/components/game/guess-map";
import { IdentityAvatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { MapGlyph, CountryGlyph } from "@/components/map-glyph";
import { countryName } from "@/lib/countries-meta";
import { formatDistance, formatNumber } from "@/lib/format";
import { getMapConfig, mapNameKey } from "@/lib/maps-config";
import { MAX_ROUND_SCORE, type RoundResult } from "@/lib/types";
import { useT } from "@/hooks/use-t";
import { cn } from "@/lib/utils";

export interface ReplayOwner {
  username: string;
  avatarUrl?: string;
  avatarBuildingId?: string;
  avatarColor?: string;
}

interface ReplayViewProps {
  mapId: string;
  results: RoundResult[];
  /** Omitted for a local (guest, localStorage-only) replay — there's no owner to show. */
  owner?: ReplayOwner;
}

/**
 * Presentational round-by-round replay viewer — no data fetching, no
 * knowledge of where `results` came from. Shared by the public Convex-backed
 * `/replay/[gameId]` route (`ReplayClient`) and the local (guest,
 * localStorage-only) replay dialog on the profile page.
 */
export function ReplayView({ mapId, results, owner }: ReplayViewProps) {
  const t = useT();
  const [selected, setSelected] = useState<number | null>(null);
  const map = getMapConfig(mapId);
  const totalScore = results.reduce((sum, r) => sum + r.score, 0);
  const maxScore = results.length * MAX_ROUND_SCORE;
  const active = selected != null ? results.find((r) => r.round === selected) ?? null : null;

  return (
    <div className="flex w-full flex-col gap-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapGlyph mapId={mapId} className="size-6 text-primary-muted" />
          <div>
            <h1 className="text-lg font-semibold leading-tight">
              {t("replay.title", { name: t(mapNameKey(map.id)) })}
            </h1>
            {owner && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <IdentityAvatar
                  name={owner.username}
                  src={owner.avatarUrl}
                  buildingId={owner.avatarBuildingId}
                  color={owner.avatarColor}
                  className="size-4"
                />
                {owner.username}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular text-primary-muted">{formatNumber(totalScore)}</p>
          <p className="text-xs text-muted-foreground">/ {formatNumber(maxScore)}</p>
        </div>
      </header>

      {/* Round selector */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            selected == null ? "bg-overlay-hover text-foreground" : "bg-overlay text-muted-foreground hover:text-foreground",
          )}
        >
          Overview
        </button>
        {results.map((r) => (
          <button
            key={r.round}
            type="button"
            onClick={() => setSelected(r.round)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              selected === r.round ? "bg-overlay-hover text-foreground" : "bg-overlay text-muted-foreground hover:text-foreground",
            )}
          >
            R{r.round}
          </button>
        ))}
      </div>

      <div className="h-72 overflow-hidden rounded-2xl border border-border sm:h-96">
        {active ? (
          <GuessMap
            key={active.round}
            guess={active.guess}
            actual={active.actual}
            reveal
            interactive={false}
            initialView={map.view}
          />
        ) : (
          <MatchMap results={results} initialView={map.view} />
        )}
      </div>

      {active && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium">
              <CountryGlyph className="size-4" /> {countryName(active.actual.countryCode)}
            </span>
            <span className="font-semibold tabular text-primary-muted">{formatNumber(active.score)}</span>
          </div>
          <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
            {active.guess ? `${formatDistance(active.distanceMeters)} away` : "No guess"}
          </p>
          <Progress value={active.score / MAX_ROUND_SCORE} />
        </div>
      )}

      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {results.map((r) => (
          <button
            key={r.round}
            type="button"
            onClick={() => setSelected(r.round)}
            className="flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-elevated"
          >
            <span className="w-5 text-xs font-semibold tabular text-muted-foreground">{r.round}</span>
            <CountryGlyph className="size-4" />
            <span
              className="min-w-0 flex-1 truncate text-sm font-medium"
              title={countryName(r.actual.countryCode)}
            >
              {countryName(r.actual.countryCode)}
            </span>
            <span className="text-xs text-muted-foreground">
              {r.guess ? formatDistance(r.distanceMeters) : "No guess"}
            </span>
            <span className="w-14 text-right text-sm font-semibold tabular text-primary-muted">
              {formatNumber(r.score)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
