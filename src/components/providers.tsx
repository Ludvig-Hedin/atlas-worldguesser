"use client";

import { type ReactNode } from "react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { EnsureUser } from "@/components/auth/ensure-user";
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

  if (features.auth && convexClient) {
    return (
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
          <EnsureUser />
          {inner}
        </ConvexProviderWithClerk>
      </ClerkProvider>
    );
  }

  if (clerkPublishableKey) {
    return <ClerkProvider publishableKey={clerkPublishableKey}>{inner}</ClerkProvider>;
  }

  return inner;
}
