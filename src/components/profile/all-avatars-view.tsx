"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { ChevronLeft } from "lucide-react";
import { api } from "@convex/_generated/api";
import { useLocalProfile } from "@/hooks/use-local-profile";
import { AvatarPicker } from "./avatar-picker";
import { UnlockedBuildingsGrid } from "./unlocked-buildings-grid";
import { Skeleton } from "@/components/ui/skeleton";
import { BUILDING_LIST } from "@/lib/buildings";
import { useT } from "@/hooks/use-t";
import { features } from "@/lib/env";

function BackLink() {
  const t = useT();
  return (
    <Link
      href="/profile"
      className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="size-4" />
      {t("common.back")}
    </Link>
  );
}

function CloudAllAvatars() {
  const me = useQuery(api.users.getMe, {});
  if (me === undefined) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }
  if (!me) return null; // provisioning still in flight (ensure-user)
  return (
    <AvatarPicker
      avatarBuildingId={me.avatarBuildingId}
      avatarColor={me.avatarColor}
      unlockedBuildings={me.unlockedBuildings}
    />
  );
}

function GuestAllAvatars() {
  const { profile, ready } = useLocalProfile();
  const t = useT();

  if (!ready) return <Skeleton className="h-64 w-full rounded-2xl" />;

  const unlockedSet = new Set(profile.unlockedBuildings);
  const unlockedBuildingDefs = BUILDING_LIST.filter((b) => unlockedSet.has(b.id));

  if (unlockedBuildingDefs.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("profile.noAvatarsYet")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{t("profile.avatarGuestHint")}</p>
      <UnlockedBuildingsGrid buildings={unlockedBuildingDefs} />
    </div>
  );
}

/**
 * `useConvexAuth()` throws if no Convex/Clerk provider is mounted, which is
 * the case in a fully key-less deployment. Only ever mount this where
 * `features.auth` is true, mirroring the gate in guest-profile.tsx.
 */
function AuthGate({ children }: { children: (isAuthenticated: boolean) => ReactNode }) {
  // TODO(bug-hunt): no isLoading check — while Convex resolves the Clerk JWT,
  // isAuthenticated reads false, so a signed-in user briefly sees
  // <GuestAllAvatars /> (their local unlocked buildings) before flipping to
  // <CloudAllAvatars />. Same latent flash as AuthGate in guest-profile.tsx;
  // fix both together by gating on isLoading with a skeleton.
  const { isAuthenticated } = useConvexAuth();
  return <>{children(isAuthenticated)}</>;
}

export function AllAvatarsView() {
  const t = useT();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-3">
        <BackLink />
        <h1 className="text-2xl font-semibold tracking-tight">{t("profile.allAvatarsTitle")}</h1>
      </div>
      {features.auth ? (
        <AuthGate>{(isAuthenticated) => (isAuthenticated ? <CloudAllAvatars /> : <GuestAllAvatars />)}</AuthGate>
      ) : (
        <GuestAllAvatars />
      )}
    </div>
  );
}
