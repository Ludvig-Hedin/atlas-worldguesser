"use client";

import Link from "next/link";
import { Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { features } from "@/lib/env";

/** Renders children only when Convex is configured, else an explanatory message. */
export function ConvexGate({ children, label = "This feature" }: { children: React.ReactNode; label?: string }) {
  if (!features.convex) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <Globe2 className="size-8 text-primary-muted" />
        <h1 className="text-xl font-semibold">{label} needs setup</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {label} runs on Convex + Clerk. Add the keys from{" "}
          <code className="rounded bg-overlay px-1">.env.example</code> to enable it.
        </p>
        <Button asChild>
          <Link href="/play">Play solo instead</Link>
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
