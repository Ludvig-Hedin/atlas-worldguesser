import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ConvexGate } from "@/components/convex-gate";
import { PartyClient } from "@/components/multiplayer/party-client";

export const metadata: Metadata = {
  title: "Party",
  description:
    "Group up with friends and play multiplayer GeoGuessr together — invite your party and jump into the same room in one click.",
  alternates: { canonical: "/party" },
};

export default function PartyPage() {
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <ConvexGate label="Parties">
        <PartyClient />
      </ConvexGate>
    </div>
  );
}
