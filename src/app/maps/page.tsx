import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { MapsClient } from "@/components/maps/maps-client";
import { ConvexGate } from "@/components/convex-gate";

export const metadata: Metadata = {
  title: "Custom maps",
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
