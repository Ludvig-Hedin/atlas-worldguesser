"use client";

import Link from "next/link";
import { HeroMenu } from "@/components/home/hero-menu";
import { LiveStats } from "@/components/live-stats";
import { AuthSlot } from "@/components/auth/auth-slot";
import { GithubMark } from "@/components/github-mark";
import { SettingsMenu } from "@/components/preferences/settings-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/hooks/use-t";
import { features } from "@/lib/env";

const GITHUB_REPO_URL = "https://github.com/Ludvig-Hedin/atlas-worldguesser";

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
    <div className="pointer-events-none absolute inset-0 flex flex-col items-start gap-6 px-4 py-8 sm:block sm:px-0 sm:py-0">
      {/* Subtle backdrop behind the left menu, for legibility over the globe */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-[28rem] max-w-[60vw] bg-[linear-gradient(to_right,color-mix(in_srgb,var(--background)_45%,transparent),transparent_85%)] sm:block"
      />

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

      {/* Bottom cluster: settings + GitHub + online badge grouped in one row,
          pinned to the bottom on mobile (`mt-auto` in the flex column); `sm:contents`
          drops the wrapper at the sm breakpoint so the two groups return to
          being independent absolutely-positioned corners on desktop. */}
      <div className="mt-auto flex flex-wrap items-center gap-3 sm:contents">
        {/* Bottom-left: settings + GitHub */}
        <div className="pointer-events-auto flex items-center gap-1.5 opacity-0 animate-[fade-up_0.5s_ease-out_forwards] [animation-delay:160ms] sm:absolute sm:bottom-6 sm:left-6">
          <SettingsMenu showLabel />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" asChild aria-label={t("nav.github")}>
                <Link href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
                  <GithubMark className="size-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("nav.github")}</TooltipContent>
          </Tooltip>
        </div>

        {/* Bottom-right: online badge */}
        {features.auth && (
          <div className="pointer-events-auto opacity-0 animate-[fade-up_0.5s_ease-out_forwards] [animation-delay:240ms] sm:absolute sm:bottom-6 sm:right-6">
            <LiveStats />
          </div>
        )}
      </div>
    </div>
  );
}
