"use client";

import { SignInButton } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { AccountWidget } from "@/components/auth/account-widget";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/hooks/use-t";
import { features } from "@/lib/env";

/** Renders Clerk auth controls only when auth is configured; otherwise nothing. */
export function AuthSlot() {
  if (!features.auth) return null;
  return <AuthControls />;
}

function AuthControls() {
  // Drive the header off Convex auth (`isAuthenticated`) — the SAME source every
  // gated page/content surface uses — NOT Clerk's optimistic `useUser().isSignedIn`.
  // Using Clerk here caused split-brain UX: the header showed "signed in" the
  // instant Clerk loaded, while page content still read Convex and showed "Sign
  // in" until the JWT validated (a long window on slow links). Both now agree.
  const { isLoading, isAuthenticated } = useConvexAuth();
  const t = useT();
  // Subtle skeleton (not an empty gap) while auth resolves.
  if (isLoading) return <div className="size-8 animate-pulse rounded-full bg-overlay" aria-hidden />;
  if (isAuthenticated) {
    return <AccountWidget />;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <SignInButton mode="modal">
          <Button size="sm">{t("auth.signIn")}</Button>
        </SignInButton>
      </TooltipTrigger>
      <TooltipContent>{t("auth.signInTooltip")}</TooltipContent>
    </Tooltip>
  );
}
