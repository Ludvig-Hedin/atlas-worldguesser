"use client";

import Link from "next/link";
import { HeroMenu } from "@/components/home/hero-menu";
import { LiveStats } from "@/components/live-stats";
import { AuthSlot } from "@/components/auth/auth-slot";
import { SettingsMenu } from "@/components/preferences/settings-menu";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/use-t";
import { features } from "@/lib/env";

/**
 * WorldGuessr-style four-corner overlay for the homepage hero, laid over the
 * full-viewport globe. Each corner's content is mounted exactly once —
 * Tailwind `sm:` classes reposition the same elements between a centered
 * mobile stack and absolute corners, so MultiplayerEntry/LiveStats never
 * double-mount (which would double their Convex subscriptions).
 *
 * Wrapper stays `pointer-events-none` so empty space between corners still
 * lets the globe canvas receive drag input; each corner group opts back in
 * with `pointer-events-auto`.
 */
export function HeroOverlay() {
  const t = useT();

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-8 px-6 py-10 sm:block sm:px-0 sm:py-0">
      {/* Top-left: logo + menu */}
      <div className="pointer-events-auto opacity-0 animate-[fade-up_0.5s_ease-out_forwards] sm:absolute sm:left-6 sm:top-6">
        <HeroMenu />
      </div>

      {/* Top-right: Maps + Auth */}
      <div className="pointer-events-auto flex items-center gap-2 opacity-0 animate-[fade-up_0.5s_ease-out_forwards] [animation-delay:80ms] sm:absolute sm:right-6 sm:top-6">
        {features.convex && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/maps">{t("nav.maps")}</Link>
          </Button>
        )}
        <AuthSlot />
      </div>

      {/* Bottom-left: settings */}
      <div className="pointer-events-auto opacity-0 animate-[fade-up_0.5s_ease-out_forwards] [animation-delay:160ms] sm:absolute sm:bottom-6 sm:left-6">
        <SettingsMenu />
      </div>

      {/* Bottom-right: online badge */}
      {features.auth && (
        <div className="pointer-events-auto opacity-0 animate-[fade-up_0.5s_ease-out_forwards] [animation-delay:240ms] sm:absolute sm:bottom-6 sm:right-6">
          <LiveStats />
        </div>
      )}
    </div>
  );
}
