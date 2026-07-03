import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { MapsClient } from "@/components/maps/maps-client";
import { ConvexGate } from "@/components/convex-gate";

export const metadata: Metadata = {
  title: "Custom maps",
  description:
    "Browse and play community-made custom maps, or build your own geography guessing game. Pick a region, drop into Street View, and guess the location.",
  alternates: { canonical: "/maps" },
};

export default function MapsPage() {
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <ConvexGate label="Custom maps">
        <MapsClient />
      </ConvexGate>
    </div>
  );
}
