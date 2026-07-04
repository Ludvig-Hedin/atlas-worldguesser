import type { Metadata } from "next";
import { ConvexGate } from "@/components/convex-gate";
import { ChallengeClient } from "@/components/challenge/challenge-client";
import { NOINDEX } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Challenge",
  robots: NOINDEX,
};

export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ConvexGate label="Challenges">
      <ChallengeClient challengeId={id} />
    </ConvexGate>
  );
}
