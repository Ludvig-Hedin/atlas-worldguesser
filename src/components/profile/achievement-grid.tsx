import { Lock } from "lucide-react";
import { ACHIEVEMENTS, type AchievementTier } from "@/lib/achievements";
import { AchievementIcon } from "@/components/achievement-icon";
import { cn } from "@/lib/utils";

const TIER_RING: Record<AchievementTier, string> = {
  bronze: "ring-amber-700/40",
  silver: "ring-zinc-400/40",
  gold: "ring-gold/50",
};

export function AchievementGrid({ owned }: { owned: string[] }) {
  const ownedSet = new Set(owned);
  const unlocked = ACHIEVEMENTS.filter((a) => ownedSet.has(a.id)).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Achievements</h2>
        <span className="text-xs text-muted-foreground tabular">
          {unlocked}/{ACHIEVEMENTS.length}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const has = ownedSet.has(a.id);
          return (
            <div
              key={a.id}
              className={cn(
                "flex items-start gap-3 rounded-2xl border border-border p-3.5 transition-colors",
                has ? cn("bg-card ring-1", TIER_RING[a.tier]) : "bg-card/40 opacity-60",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full",
                  has ? "bg-primary/12 text-primary-muted" : "bg-white/5",
                )}
                aria-hidden
              >
                {has ? <AchievementIcon name={a.icon} className="size-[18px]" /> : <Lock className="size-4 text-subtle" />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{a.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
