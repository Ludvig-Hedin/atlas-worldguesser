"use client";

import { type ReactNode } from "react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { EnsureUser } from "@/components/auth/ensure-user";
import { PresencePing } from "@/components/presence-ping";
import { RoomInviteNotifier } from "@/components/multiplayer/room-invite-notifier";
import { GuestSessionProvider } from "@/components/guest/guest-session-provider";
import { PreferencesProvider } from "@/components/preferences/preferences-provider";
import { clerkPublishableKey, convexUrl, features } from "@/lib/env";

// Single Convex client instance for the browser session (only when configured).
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

/**
 * Wraps the app in the providers that are actually configured.
 * Order: Clerk (auth) → Convex (realtime, needs Clerk identity) → UI providers.
 * With no keys at all, only the UI providers render and solo play still works.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const inner = (
    <TooltipProvider delayDuration={200}>
      {children}
      <Toaster />
    </TooltipProvider>
  );

  let tree: ReactNode;
  if (features.auth && convexClient) {
    tree = (
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
          <EnsureUser />
          <PresencePing />
          <RoomInviteNotifier />
          <GuestSessionProvider>{inner}</GuestSessionProvider>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    );
  } else if (clerkPublishableKey) {
    tree = <ClerkProvider publishableKey={clerkPublishableKey}>{inner}</ClerkProvider>;
  } else {
    tree = inner;
  }

  // Preferences (theme/language/map type) wrap everything so every branch — and
  // the fully key-less solo build — gets the same device-local settings.
  return <PreferencesProvider>{tree}</PreferencesProvider>;
}
