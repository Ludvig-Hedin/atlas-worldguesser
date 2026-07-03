"use client";

import { Scoreboard, type Standing } from "./scoreboard";
import { useT } from "@/hooks/use-t";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Id } from "@convex/_generated/dataModel";

const TEAM_ACCENT = {
  A: "text-primary-muted",
  B: "text-gold",
} as const;

interface TeamScoreboardProps {
  standings: Standing[];
  myUserId: Id<"users"> | null;
  phase: "lobby" | "active" | "roundResult" | "finished";
  teamTotals: { A: number; B: number };
  className?: string;
}

/**
 * Groups standings into Team A / Team B with subtotals, reusing the flat
 * Scoreboard per team. Any unassigned members surface in their own group so
 * they're never silently hidden.
 */
export function TeamScoreboard({
  standings,
  myUserId,
  phase,
  teamTotals,
  className,
}: TeamScoreboardProps) {
  const t = useT();
  const unassigned = standings.filter((s) => !s.team);
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {(["A", "B"] as const).map((team) => {
        const members = standings.filter((s) => s.team === team);
        return (
          <div key={team} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-1">
              <span className={cn("text-xs font-semibold uppercase tracking-wide", TEAM_ACCENT[team])}>
                {team === "A" ? t("team.teamA") : t("team.teamB")}
              </span>
              {phase !== "lobby" && (
                <span className="text-sm font-semibold tabular">{formatNumber(teamTotals[team])}</span>
              )}
            </div>
            {members.length === 0 ? (
              <p className="rounded-xl bg-overlay px-2.5 py-2 text-xs text-muted-foreground">
                {t("team.noPlayersYet")}
              </p>
            ) : (
              <Scoreboard standings={members} myUserId={myUserId} phase={phase} />
            )}
          </div>
        );
      })}
      {unassigned.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("team.unassigned")}
          </span>
          <Scoreboard standings={unassigned} myUserId={myUserId} phase={phase} />
        </div>
      )}
    </div>
  );
}
