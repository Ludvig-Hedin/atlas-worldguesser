"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { toast } from "sonner";
import { ArrowRight, Check, Crown, LogOut, Play, UserPlus, Users, X } from "lucide-react";
import { api } from "@convex/_generated/api";
import { IdentityAvatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/hooks/use-t";
import { DEFAULT_SETTINGS } from "@/lib/maps-config";

export function PartyClient() {
  const t = useT();
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t("party.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("party.subtitle")}</p>
      </div>
      <Authenticated>
        <PartyInner />
      </Authenticated>
      <Unauthenticated>
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <Users className="mx-auto mb-3 size-8 text-primary-muted" />
          <p className="mb-4 text-sm text-muted-foreground">{t("party.signInPrompt")}</p>
          <SignInButton mode="modal">
            <Button>{t("auth.signIn")}</Button>
          </SignInButton>
        </div>
      </Unauthenticated>
    </div>
  );
}

function PartyInner() {
  const t = useT();
  const router = useRouter();
  const data = useQuery(api.parties.mine);
  const friendsData = useQuery(api.friends.list);
  const createParty = useMutation(api.parties.create);
  const invite = useMutation(api.parties.invite);
  const respond = useMutation(api.parties.respond);
  const leave = useMutation(api.parties.leave);
  const startRoom = useMutation(api.parties.startRoom);
  const [busy, setBusy] = useState(false);

  if (data === undefined) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  const { party, invites } = data;

  const handleStart = async () => {
    if (!party) return;
    setBusy(true);
    try {
      const { code } = await startRoom({
        partyId: party._id,
        mapId: "world",
        settings: DEFAULT_SETTINGS,
      });
      router.push(`/room/${code}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("party.couldNotStartRoom"));
      setBusy(false);
    }
  };

  // Not in a party — show any pending invites plus a create button.
  if (!party) {
    return (
      <div className="flex flex-col gap-4">
        {invites.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">{t("party.invitationsTitle")}</h2>
            {invites.map((inv) => (
              <div
                key={inv.partyId}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <Users className="size-5 shrink-0 text-primary-muted" />
                <span className="min-w-0 flex-1 text-sm">
                  {t("party.invitedYou", { name: inv.leaderName })}
                </span>
                <Button
                  size="sm"
                  onClick={() =>
                    respond({ partyId: inv.partyId, accept: true }).catch((e) =>
                      toast.error(e instanceof Error ? e.message : t("party.couldNotJoinParty")),
                    )
                  }
                >
                  <Check className="size-4" /> {t("common.join")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t("party.declineAria")}
                  onClick={() => respond({ partyId: inv.partyId, accept: false }).catch(() => {})}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <Users className="mx-auto mb-3 size-8 text-primary-muted" />
          <p className="mb-4 text-sm text-muted-foreground">{t("party.createPrompt")}</p>
          <Button
            onClick={() =>
              createParty().catch((e) =>
                toast.error(e instanceof Error ? e.message : t("party.couldNotCreate")),
              )
            }
          >
            <Users className="size-4" /> {t("party.createButton")}
          </Button>
        </div>
      </div>
    );
  }

  const joinedCount = party.members.filter((m) => m.status === "joined").length;
  const invitedCount = party.members.filter((m) => m.status === "invited").length;
  const memberIds = new Set(party.members.map((m) => m.userId));
  const invitableFriends = (friendsData?.friends ?? []).filter((f) => !memberIds.has(f._id));

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("party.yourParty")}</h2>
          <span className="text-xs text-muted-foreground">
            {invitedCount > 0
              ? t("party.inCountInvited", { joined: joinedCount, invited: invitedCount })
              : t("party.inCount", { joined: joinedCount })}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {party.members.map((m) => (
            <div key={m.userId} className="flex items-center gap-2.5 rounded-xl bg-overlay px-2.5 py-2">
              <IdentityAvatar name={m.username} className="size-7" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium" title={m.username}>
                {m.username}
              </span>
              {m.isLeader && (
                <Badge variant="muted" className="gap-1">
                  <Crown className="size-3 text-gold" /> {t("party.leader")}
                </Badge>
              )}
              {m.status === "invited" && <Badge variant="muted">{t("party.invited")}</Badge>}
            </div>
          ))}
        </div>
      </div>

      {party.amLeader && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">{t("party.inviteFriendsTitle")}</h2>
          {invitableFriends.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("party.noFriendsLeft")}{" "}
              <Link href="/friends" className="text-primary-muted underline-offset-2 hover:underline">
                {t("party.addFriends")}
              </Link>
              .
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {invitableFriends.map((f) => (
                <div key={f._id} className="flex items-center gap-2.5 rounded-xl bg-overlay px-2.5 py-2">
                  <IdentityAvatar name={f.username} src={f.avatarUrl} className="size-7" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium" title={f.username}>
                    {f.username}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      invite({ partyId: party._id, friendId: f._id })
                        .then(() => toast.success(t("party.invitedToast", { name: f.username })))
                        .catch((e) =>
                          toast.error(e instanceof Error ? e.message : t("party.couldNotInvite")),
                        )
                    }
                  >
                    <UserPlus className="size-4" /> {t("party.invite")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {party.amLeader ? (
          party.activeRoomCode ? (
            <Button
              size="lg"
              className="flex-1 basis-auto"
              onClick={() => router.push(`/room/${party.activeRoomCode}`)}
            >
              <ArrowRight className="size-4" /> {t("party.rejoinRoom")}
            </Button>
          ) : (
            <Button size="lg" className="flex-1 basis-auto" onClick={handleStart} disabled={busy}>
              <Play className="size-4" /> {t("party.startRoomTogether")}
            </Button>
          )
        ) : party.activeRoomCode ? (
          <Button
            size="lg"
            className="flex-1 basis-auto"
            onClick={() => router.push(`/room/${party.activeRoomCode}`)}
          >
            <ArrowRight className="size-4" /> {t("party.joinRoom")}
          </Button>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
            {t("party.waitingForLeader")}
          </div>
        )}
        <Button
          size="lg"
          variant="secondary"
          className="flex-1 basis-auto"
          onClick={() => leave({ partyId: party._id }).catch(() => {})}
        >
          <LogOut className="size-4" /> {t("mp.leave")}
        </Button>
      </div>

      {party.amLeader && party.activeRoomCode && (
        <p className="text-center text-xs text-muted-foreground">
          {t("party.roomLive", { code: party.activeRoomCode })}
        </p>
      )}
    </div>
  );
}
