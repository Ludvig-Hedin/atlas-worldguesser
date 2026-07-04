import type { Metadata } from "next";
import { GlobeBackground } from "@/components/globe-background";
import { HomeContent } from "@/components/home-content";

// Moved here from the root layout so only the homepage canonicalizes to "/".
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    // `isolate` pins the globe canvas's negative z-index to this local stacking
    // context — without it, `relative` alone doesn't create one, so the fixed
    // canvas escapes to the page root and the hero's `pointer-events-none`
    // click-through (see home-content.tsx) can't reach it.
    <div className="isolate relative flex min-h-[100dvh] flex-col">
      {/* Hoisted to <head> by React 19 — starts the globe point-cloud fetch in
          parallel with JS hydration instead of after it, so the globe animates
          in sooner on first load. */}
      <link rel="preload" href="/globe.json" as="fetch" crossOrigin="anonymous" fetchPriority="high" />

      {/* Spinning dotted globe, fixed behind everything. Drag to spin it. */}
      <GlobeBackground className="fixed inset-0 -z-20 block h-full w-full" />

      {/* Readability compositing over the globe — theme-aware scrim so it works on
          both the near-black dark canvas and the near-white light canvas */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,color-mix(in_srgb,var(--background)_62%,transparent),transparent_58%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_60%,color-mix(in_srgb,var(--background)_50%,transparent)_100%)]" />
        <div className="absolute left-1/2 top-[46%] size-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[140px]" />
      </div>

      <HomeContent />
    </div>
  );
}
