"use client";

import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { features } from "@/lib/env";

/** Renders Clerk auth controls only when auth is configured; otherwise nothing. */
export function AuthSlot() {
  if (!features.auth) return null;
  return <AuthControls />;
}

function AuthControls() {
  const { isLoaded, isSignedIn } = useUser();
  // Subtle skeleton (not an empty gap) while Clerk initializes.
  if (!isLoaded) return <div className="size-8 animate-pulse rounded-full bg-overlay" aria-hidden />;
  if (isSignedIn) {
    return <UserButton appearance={{ elements: { avatarBox: { width: "2rem", height: "2rem" } } }} />;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <SignInButton mode="modal">
          <Button size="sm">Sign in</Button>
        </SignInButton>
      </TooltipTrigger>
      <TooltipContent>Save your progress, climb the leaderboard, and play with friends</TooltipContent>
    </Tooltip>
  );
}
