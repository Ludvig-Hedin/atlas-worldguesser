import type { Metadata } from "next";
import { CustomPlay } from "@/components/maps/custom-play";
import { ConvexGate } from "@/components/convex-gate";
import { NOINDEX } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Play custom map",
  robots: NOINDEX,
};

export default async function CustomPlayPage({ params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  return (
    <ConvexGate label="Custom maps">
      <CustomPlay mapId={mapId} />
    </ConvexGate>
  );
}
