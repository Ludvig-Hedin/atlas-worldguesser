"use client";

import { Check, Crown, Loader2, WifiOff } from "lucide-react";
import { IdentityAvatar } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/hooks/use-t";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Id } from "@convex/_generated/dataModel";

export interface Standing {
  userId: Id<"users">;
  username: string;
  avatarUrl?: string;
  avatarBuildingId?: string;
  avatarColor?: string;
  totalScore: number;
  isHost: boolean;
  connected: boolean;
  ready: boolean;
  hasGuessed: boolean;
  /** Team assignment in team mode (null/absent = FFA/unassigned). */
  team?: "A" | "B" | null;
}

interface ScoreboardProps {
  standings: Standing[];
  myUserId: Id<"users"> | null;
  phase: "lobby" | "active" | "roundResult" | "finished";
  className?: string;
}

export function Scoreboard({ standings, myUserId, phase, className }: ScoreboardProps) {
  const t = useT();
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {standings.map((s, i) => {
        const isMe = s.userId === myUserId;
        return (
          <div
            key={s.userId}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors",
              isMe ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : "bg-overlay",
            )}
          >
            {phase !== "lobby" && (
              <span className="w-5 text-center text-xs font-semibold tabular text-muted-foreground">
                {i + 1}
              </span>
            )}
            <IdentityAvatar
              name={s.username}
              src={s.avatarUrl}
              buildingId={s.avatarBuildingId}
              color={s.avatarColor}
              className="size-7"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn("truncate text-sm font-medium", isMe && "text-primary-muted")}
                  title={s.username}
                >
                  {s.username}
                </span>
                {s.isHost && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex shrink-0">
                        <Crown className="size-3.5 text-gold" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{t("mp.host")}</TooltipContent>
                  </Tooltip>
                )}
                {!s.connected && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex shrink-0">
                        <WifiOff className="size-3.5 text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{t("mp.disconnected")}</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
            {phase === "lobby" ? (
              s.ready ? (
                <span className="flex items-center gap-1 text-xs font-medium text-primary-muted">
                  <Check className="size-3.5" /> {t("mp.ready")}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">{t("mp.notReady")}</span>
              )
            ) : (
              <div className="flex items-center gap-2">
                {phase === "active" &&
                  (s.hasGuessed ? (
                    <Check className="size-3.5 text-primary-muted" />
                  ) : (
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                  ))}
                <span className="w-14 text-right text-sm font-semibold tabular">
                  {formatNumber(s.totalScore)}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
