"use client";

import { WifiOff } from "lucide-react";
import type { Standing } from "./scoreboard";
import { IdentityAvatar } from "@/components/ui/avatar";
import { useT } from "@/hooks/use-t";
import { duelHealthShare } from "@/lib/duels";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Id } from "@convex/_generated/dataModel";

interface DuelHealthBarProps {
  standings: Standing[];
  myUserId: Id<"users"> | null;
  className?: string;
}

/**
 * 1v1 health-bar reframing of the existing standings — pure client-side
 * display, no new scoring math (see duelHealthShare). Relies on
 * rooms.getByCode already reporting round-start totals while a round is
 * active, so this never reveals a live in-round score before the reveal.
 */
export function DuelHealthBar({ standings, myUserId, className }: DuelHealthBarProps) {
  const t = useT();
  const me = standings.find((s) => s.userId === myUserId) ?? standings[0];
  const opp = standings.find((s) => s.userId !== me?.userId);
  const myShare = duelHealthShare(me?.totalScore ?? 0, opp?.totalScore ?? 0);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2 text-xs font-medium">
        <Side standing={me} align="left" opponentLeftLabel={t("duels.opponentLeft")} />
        <Side standing={opp} align="right" opponentLeftLabel={t("duels.opponentLeft")} />
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-overlay">
        <div className="bg-primary transition-[width] duration-500" style={{ width: `${myShare}%` }} />
        <div className="bg-gold transition-[width] duration-500" style={{ width: `${100 - myShare}%` }} />
      </div>
    </div>
  );
}

function Side({
  standing,
  align,
  opponentLeftLabel,
}: {
  standing?: Standing;
  align: "left" | "right";
  opponentLeftLabel: string;
}) {
  if (!standing) {
    return (
      <span className="flex items-center gap-1 text-muted-foreground">
        <WifiOff className="size-3.5" /> {opponentLeftLabel}
      </span>
    );
  }
  return (
    <div className={cn("flex items-center gap-1.5", align === "right" && "flex-row-reverse")}>
      <IdentityAvatar
        name={standing.username}
        src={standing.avatarUrl}
        buildingId={standing.avatarBuildingId}
        color={standing.avatarColor}
        className="size-6"
      />
      <span className="max-w-20 truncate" title={standing.username}>
        {standing.username}
      </span>
      <span className="tabular text-muted-foreground">{formatNumber(standing.totalScore)}</span>
    </div>
  );
}
