"use client";

import Link from "next/link";
import { useMutation } from "convex/react";
import { motion } from "motion/react";
import { Check, Lock } from "lucide-react";
import { api } from "@convex/_generated/api";
import { BUILDING_LIST, AVATAR_COLORS, DEFAULT_AVATAR_COLOR } from "@/lib/buildings";
import { countryName } from "@/lib/countries-meta";
import { useT } from "@/hooks/use-t";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AvatarPickerProps {
  avatarBuildingId?: string | null;
  avatarColor?: string | null;
  unlockedBuildings: string[];
  /** Cap the grid to this many buildings and show a "view all" link to /profile/avatars. Omit to render the full list. */
  limit?: number;
}

/**
 * Self-view avatar customization: a grid of curated iconic-building unlocks
 * (earned by correctly guessing that country) plus a free color swatch row.
 * Every mutation call is server-validated (setAvatar rejects a buildingId the
 * user hasn't actually unlocked) — this component never assumes success and
 * just re-renders once the underlying `getMe` query updates.
 */
export function AvatarPicker({ avatarBuildingId, avatarColor, unlockedBuildings, limit }: AvatarPickerProps) {
  const t = useT();
  const setAvatar = useMutation(api.users.setAvatar);
  const unlockedSet = new Set(unlockedBuildings);
  const color = avatarColor ?? DEFAULT_AVATAR_COLOR;
  const visibleBuildings = limit !== undefined ? BUILDING_LIST.slice(0, limit) : BUILDING_LIST;
  const hasMore = limit !== undefined && BUILDING_LIST.length > limit;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">{t("profile.avatarTitle")}</h2>
        <div className="flex items-center gap-3">
          {avatarBuildingId && (
            <button
              type="button"
              onClick={() => void setAvatar({ clearBuilding: true })}
              className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              {t("profile.avatarUseDefault")}
            </button>
          )}
          <span className="text-xs text-muted-foreground tabular">
            {unlockedBuildings.length}/{BUILDING_LIST.length}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {visibleBuildings.map((b) => {
          const unlocked = unlockedSet.has(b.id);
          const active = avatarBuildingId === b.id;
          return (
            <button
              key={b.id}
              type="button"
              disabled={!unlocked}
              onClick={() => void setAvatar({ buildingId: b.id })}
              className={cn(
                "relative flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                unlocked ? "border-border bg-card hover:border-border-strong" : "border-border bg-card/40 opacity-70",
                active && "border-primary/50 bg-primary/10 ring-1 ring-primary/40",
              )}
            >
              <span
                className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-overlay"
                style={unlocked ? { backgroundColor: color } : undefined}
                aria-hidden
              >
                {unlocked ? (
                  <img src={b.image} alt="" className="size-full object-contain p-1" />
                ) : (
                  <Lock className="size-3.5 text-subtle" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight">
                  {unlocked ? b.name : countryName(b.id)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {unlocked ? countryName(b.id) : t("profile.buildingLocked", { country: countryName(b.id) })}
                </p>
              </div>
              {active && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                >
                  <Check className="size-3" strokeWidth={3} />
                </motion.span>
              )}
            </button>
          );
        })}
      </div>

      {hasMore && (
        <Button variant="outline" size="sm" asChild className="self-start">
          <Link href="/profile/avatars">{t("profile.viewAllAvatars")}</Link>
        </Button>
      )}

      <div className="flex items-center gap-2 pt-1">
        <span className="text-xs text-muted-foreground">{t("profile.avatarColor")}</span>
        <div className="flex gap-1.5">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => void setAvatar({ color: c })}
              aria-label={c}
              className={cn(
                "size-5 rounded-full border-2 transition-transform",
                color === c ? "scale-110 border-foreground" : "border-transparent hover:scale-105",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
