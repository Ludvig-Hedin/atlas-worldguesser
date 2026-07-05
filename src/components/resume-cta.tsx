"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadLastGame, type LastGame } from "@/lib/last-game";
import { getMapConfig, mapNameKey } from "@/lib/maps-config";
import { useT } from "@/hooks/use-t";

/**
 * "Continue" shortcut on the landing hero. Reads the player's last solo setup
 * from localStorage and links straight back into it. Renders nothing (and takes
 * no layout space) for first-time visitors, so it's client-only + hydration-safe.
 */
export function ResumeCta() {
  const t = useT();
  const [last, setLast] = useState<LastGame | null>(null);

  useEffect(() => {
    setLast(loadLastGame());
  }, []);

  if (!last) return null;

  return (
    <Button
      size="md"
      variant="secondary"
      asChild
      className="w-full border-border bg-overlay backdrop-blur-sm hover:bg-overlay-hover"
    >
      <Link href="/play?resume=1">
        <RotateCcw className="size-4" />
        {t("home.continue", { label: t(mapNameKey(getMapConfig(last.mapId).id)) })}
      </Link>
    </Button>
  );
}
