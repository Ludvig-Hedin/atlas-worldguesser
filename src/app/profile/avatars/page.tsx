import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { AllAvatarsView } from "@/components/profile/all-avatars-view";
import { NOINDEX } from "@/lib/seo";

export const metadata: Metadata = {
  title: "All avatars",
  robots: NOINDEX,
};

export default function AllAvatarsPage() {
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <AllAvatarsView />
    </div>
  );
}
