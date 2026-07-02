import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { LeaderboardClient } from "@/components/leaderboard/leaderboard-client";
import { ConvexGate } from "@/components/convex-gate";

export const metadata: Metadata = {
  title: "Leaderboard",
};

export default function LeaderboardPage() {
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <ConvexGate label="Leaderboards">
        <LeaderboardClient />
      </ConvexGate>
    </div>
  );
}
