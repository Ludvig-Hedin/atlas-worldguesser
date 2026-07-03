import type { Metadata } from "next";
import { ConvexGate } from "@/components/convex-gate";
import { DailyClient } from "@/components/game/daily-client";

export const metadata: Metadata = {
  title: "Daily Challenge",
  description:
    "Play today's Daily Challenge — the same five Street View locations for everyone, once a day. Guess them all and climb the global daily leaderboard.",
  alternates: { canonical: "/daily" },
};

export default function DailyPage() {
  return (
    <ConvexGate label="The Daily Challenge">
      <DailyClient />
    </ConvexGate>
  );
}
