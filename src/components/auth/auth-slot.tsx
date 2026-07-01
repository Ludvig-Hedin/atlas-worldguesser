"use client";

import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { features } from "@/lib/env";

/** Renders Clerk auth controls only when auth is configured; otherwise nothing. */
export function AuthSlot() {
  if (!features.auth) return null;
  return <AuthControls />;
}

function AuthControls() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <div className="size-8" aria-hidden />;
  if (isSignedIn) {
    return <UserButton appearance={{ elements: { avatarBox: { width: "2rem", height: "2rem" } } }} />;
  }
  return (
    <SignInButton mode="modal">
      <Button size="sm">Sign in</Button>
    </SignInButton>
  );
}
