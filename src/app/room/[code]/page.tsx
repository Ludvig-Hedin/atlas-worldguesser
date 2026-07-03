import type { Metadata } from "next";
import { RoomClient } from "@/components/multiplayer/room-client";
import { ConvexGate } from "@/components/convex-gate";
import { NOINDEX } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Private room",
  robots: NOINDEX,
};

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <ConvexGate label="Multiplayer">
      <RoomClient code={code.toUpperCase()} />
    </ConvexGate>
  );
}
