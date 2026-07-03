"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadLastGame, type LastGame } from "@/lib/last-game";

/**
 * "Continue" shortcut on the landing hero. Reads the player's last solo setup
 * from localStorage and links straight back into it. Renders nothing (and takes
 * no layout space) for first-time visitors, so it's client-only + hydration-safe.
 */
export function ResumeCta() {
  const [last, setLast] = useState<LastGame | null>(null);

  useEffect(() => {
    setLast(loadLastGame());
  }, []);

  if (!last) return null;

  return (
    <Button
      size="lg"
      variant="secondary"
      asChild
      className="min-w-44 border-white/10 bg-white/[0.06] backdrop-blur-sm hover:bg-white/[0.1]"
    >
      <Link href="/play?resume=1">
        <RotateCcw className="size-4" />
        Continue · {last.label}
      </Link>
    </Button>
  );
}
