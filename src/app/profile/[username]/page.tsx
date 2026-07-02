import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { PublicProfile } from "@/components/profile/public-profile";
import { ConvexGate } from "@/components/convex-gate";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: `${username}` };
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
        <PublicProfile username={decodeURIComponent(username)} />
      </ConvexGate>
    </div>
  );
}
