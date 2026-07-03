import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { MapCreator } from "@/components/maps/map-creator";
import { ConvexGate } from "@/components/convex-gate";
import { NOINDEX } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Create a map",
  robots: NOINDEX,
};

export default function NewMapPage() {
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <ConvexGate label="Custom maps">
        <MapCreator />
      </ConvexGate>
    </div>
  );
}
