"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import { useT } from "@/hooks/use-t";

/**
 * Global toast surface for ad-hoc room invites (rooms.inviteFriend). Each
 * newly-seen pending invite announces once with a one-click Join action;
 * already-announced invite ids are tracked so a query re-render (e.g. a
 * second invite arriving) doesn't re-toast the first. In-app only — like
 * presence, this requires the tab to be open.
 */
export function RoomInviteNotifier() {
  const t = useT();
  const router = useRouter();
  const invites = useQuery(api.rooms.myInvites);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!invites) return;
    for (const invite of invites) {
      if (seen.current.has(invite._id)) continue;
      seen.current.add(invite._id);
      toast(t("roomInvite.toastMessage", { name: invite.fromUsername }), {
        duration: 15000,
        action: {
          label: t("common.join"),
          onClick: () => router.push(`/room/${invite.roomCode}`),
        },
      });
    }
  }, [invites, t, router]);

  return null;
}
