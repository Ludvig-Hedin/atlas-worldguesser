import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ReplayClient } from "@/components/replay/replay-client";
import { ConvexGate } from "@/components/convex-gate";
import { NOINDEX } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Replay",
  robots: NOINDEX,
};

export default async function ReplayPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <ConvexGate label="Replays">
        <ReplayClient gameId={gameId} />
      </ConvexGate>
    </div>
  );
}
