"use client";

import Link from "next/link";
import { Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthSlot } from "@/components/auth/auth-slot";
import { features } from "@/lib/env";

export function SiteHeader() {
  return (
    <header className="z-10 flex items-center justify-between px-5 py-4">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Globe2 className="size-5 text-primary-muted" />
        Atlas
      </Link>
      <nav className="flex items-center gap-0.5 sm:gap-1.5">
        {features.convex && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/leaderboard">Leaderboard</Link>
          </Button>
        )}
        {features.auth && (
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/friends">Friends</Link>
          </Button>
        )}
        <Button variant="ghost" size="sm" asChild>
          <Link href="/profile">Stats</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/play">Play</Link>
        </Button>
        <AuthSlot />
      </nav>
    </header>
  );
}
