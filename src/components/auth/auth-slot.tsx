"use client";

import { SignInButton, useUser } from "@clerk/nextjs";
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
  const { isLoaded, isSignedIn } = useUser();
  const t = useT();
  // Subtle skeleton (not an empty gap) while Clerk initializes.
  if (!isLoaded) return <div className="size-8 animate-pulse rounded-full bg-overlay" aria-hidden />;
  if (isSignedIn) {
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
