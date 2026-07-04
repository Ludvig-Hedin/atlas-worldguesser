"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useClerk } from "@clerk/nextjs";
import { ChevronDown, LogOut, User as UserIcon, UserCog } from "lucide-react";
import { api } from "@convex/_generated/api";
import { IdentityAvatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/hooks/use-t";

/**
 * Signed-in account widget: avatar + username + level badge, all one dropdown
 * trigger (Profile / Manage account / Sign out). Replaces Clerk's bare
 * `UserButton` avatar with a game-ish widget using our own identity data
 * (username/avatar/level already come from Convex, not Clerk's user object).
 */
export function AccountWidget() {
  const t = useT();
  const { signOut, openUserProfile } = useClerk();
  const me = useQuery(api.users.getMe);

  if (me === undefined) {
    return <div className="h-9 w-24 animate-pulse rounded-full bg-overlay" aria-hidden />;
  }
  if (me === null) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-border bg-overlay py-1 pl-1.5 pr-1.5 backdrop-blur-sm transition-colors hover:border-border-strong hover:bg-overlay-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <IdentityAvatar
            name={me.username}
            src={me.avatarUrl}
            buildingId={me.avatarBuildingId}
            color={me.avatarColor}
            className="size-7"
          />
          <span className="flex items-center gap-1 text-sm font-semibold">
            <span className="max-w-28 truncate">{me.username}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </span>
          <span className="ml-0.5 flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-muted text-xs font-bold text-primary-foreground shadow-1 ring-2 ring-primary/25">
            {me.level}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserIcon className="size-4" />
            {t("nav.profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openUserProfile()}>
          <UserCog className="size-4" />
          {t("auth.manageAccount")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()} className="text-destructive">
          <LogOut className="size-4" />
          {t("auth.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
