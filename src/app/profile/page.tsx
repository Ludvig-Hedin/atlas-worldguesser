import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { GuestProfile } from "@/components/profile/guest-profile";
import { NOINDEX } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Your stats",
  robots: NOINDEX,
};

export default function ProfilePage() {
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <GuestProfile />
    </div>
  );
}
