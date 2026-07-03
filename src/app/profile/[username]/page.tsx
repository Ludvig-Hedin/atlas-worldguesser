import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { PublicProfile } from "@/components/profile/public-profile";
import { ConvexGate } from "@/components/convex-gate";
import { NOINDEX } from "@/lib/seo";

function decodeUsername(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw; // malformed percent-encoding — show as-is
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  // Decode like the page body does — otherwise "jörgen" titles as "j%C3%B6rgen".
  return { title: decodeUsername(username), robots: NOINDEX };
}

export default async function ProfileByUsernamePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <ConvexGate label="Profiles">
        <PublicProfile username={decodeUsername(username)} />
      </ConvexGate>
    </div>
  );
}
