import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { FriendsClient } from "@/components/social/friends-client";
import { ConvexGate } from "@/components/convex-gate";

export const metadata: Metadata = {
  title: "Friends",
};

export default function FriendsPage() {
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <ConvexGate label="Friends">
        <FriendsClient />
      </ConvexGate>
    </div>
  );
}
