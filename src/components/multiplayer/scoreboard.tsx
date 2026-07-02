"use client";

import { Check, Crown, Loader2, WifiOff } from "lucide-react";
import { IdentityAvatar } from "@/components/ui/avatar";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Id } from "@convex/_generated/dataModel";

export interface Standing {
  userId: Id<"users">;
  username: string;
  totalScore: number;
  isHost: boolean;
  connected: boolean;
  ready: boolean;
  hasGuessed: boolean;
}

interface ScoreboardProps {
  standings: Standing[];
  myUserId: Id<"users"> | null;
  phase: "lobby" | "active" | "roundResult" | "finished";
  className?: string;
}

export function Scoreboard({ standings, myUserId, phase, className }: ScoreboardProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {standings.map((s, i) => {
        const isMe = s.userId === myUserId;
        return (
          <div
            key={s.userId}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors",
              isMe ? "bg-primary/10" : "bg-white/[0.03]",
            )}
          >
            {phase !== "lobby" && (
              <span className="w-5 text-center text-xs font-semibold tabular text-muted-foreground">
                {i + 1}
              </span>
            )}
            <IdentityAvatar name={s.username} className="size-7" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={cn("truncate text-sm font-medium", isMe && "text-primary-muted")}>
                  {s.username}
                </span>
                {s.isHost && <Crown className="size-3 shrink-0 text-gold" />}
                {!s.connected && <WifiOff className="size-3 shrink-0 text-muted-foreground" />}
              </div>
            </div>
            {phase === "lobby" ? (
              s.ready ? (
                <span className="flex items-center gap-1 text-xs font-medium text-primary-muted">
                  <Check className="size-3.5" /> Ready
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Not ready</span>
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
