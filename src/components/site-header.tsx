"use client";

import Link from "next/link";
import { AtlasMark } from "@/components/atlas-mark";
import { Button } from "@/components/ui/button";
import { AuthSlot } from "@/components/auth/auth-slot";
import { SettingsMenu } from "@/components/preferences/settings-menu";
import { useT } from "@/hooks/use-t";
import { features } from "@/lib/env";

export function SiteHeader() {
  const t = useT();
  return (
    <header className="pointer-events-auto z-10 flex items-center justify-between px-5 py-4">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <AtlasMark className="size-5 text-primary-muted" />
        Atlas
      </Link>
      <nav className="flex items-center gap-0.5 sm:gap-1.5">
        {features.convex && (
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/maps">{t("nav.maps")}</Link>
          </Button>
        )}
        {features.convex && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/leaderboard">{t("nav.leaderboard")}</Link>
          </Button>
        )}
        {features.auth && (
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/friends">{t("nav.friends")}</Link>
          </Button>
        )}
        <Button variant="ghost" size="sm" asChild>
          <Link href="/profile">{t("nav.stats")}</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
          <Link href="/flags">{t("nav.flags")}</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/play">{t("nav.play")}</Link>
        </Button>
        <SettingsMenu />
        <AuthSlot />
      </nav>
    </header>
  );
}
