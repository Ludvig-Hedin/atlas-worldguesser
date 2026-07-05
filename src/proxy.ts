import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Clerk session handling for the Next 16 "proxy" convention (this file was
 * `middleware.ts` before Next 16 renamed it — see next/docs upgrade guide).
 *
 * @clerk/nextjs REQUIRES this to exist. Without it Clerk never runs its session
 * handshake, so the browser keeps a Clerk session but can't refresh a usable
 * session token. `ConvexProviderWithClerk` then never receives a valid JWT,
 * `useConvexAuth()` stays `isAuthenticated: false`, and a signed-in player is
 * treated as a GUEST (getMe → null, the AccountWidget renders blank, and
 * "Sign in to claim" can't resolve). A first-time sign-in (no prior cookie)
 * fails to establish a durable session at all. Just running clerkMiddleware()
 * fixes this — no route protection is needed here because Convex enforces auth
 * server-side on every mutation/query.
 *
 * Guarded so the zero-config solo build still boots: with no publishable key we
 * pass every request straight through instead of letting clerkMiddleware throw
 * "Missing publishableKey" on every route. The key is inlined at build time and
 * mirrors `features.auth` in src/lib/env.ts.
 */
const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());

export default clerkConfigured ? clerkMiddleware() : () => NextResponse.next();

export const config = {
  matcher: [
    // Run on every route EXCEPT Next internals and static asset files — a
    // missing matcher would run auth logic on CSS/JS/images too (see next docs
    // proxy.md), needlessly and sometimes breaking asset delivery.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
