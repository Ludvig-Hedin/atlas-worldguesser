"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn, hashString } from "@/lib/utils";
import { BUILDINGS, DEFAULT_AVATAR_COLOR } from "@/lib/buildings";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex size-9 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn("aspect-square size-full object-cover", className)} {...props} />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn("flex size-full items-center justify-center bg-overlay text-xs font-semibold uppercase", className)}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

const GRADIENTS = [
  "linear-gradient(135deg,#0a84ff,#5e5ce6)",
  "linear-gradient(135deg,#5e5ce6,#bf5af2)",
  "linear-gradient(135deg,#0a84ff,#40c8e0)",
  "linear-gradient(135deg,#ff9f0a,#ff375f)",
  "linear-gradient(135deg,#bf5af2,#ff375f)",
  "linear-gradient(135deg,#40c8e0,#0a84ff)",
];

/**
 * A deterministic gradient avatar with initials — for users without a photo.
 * When `buildingId` resolves to a curated iconic-building avatar, that takes
 * over entirely (color fills the background chip behind it); otherwise falls
 * through to the existing photo/gradient-initials behavior unchanged. An
 * unrecognized buildingId (e.g. one retired from the catalog) silently falls
 * back rather than rendering a broken image.
 */
function IdentityAvatar({
  name,
  src,
  buildingId,
  color,
  className,
}: {
  name: string;
  src?: string | null;
  buildingId?: string | null;
  color?: string | null;
  className?: string;
}) {
  const initials = name.trim().slice(0, 2).toUpperCase() || "??";
  const gradient = GRADIENTS[hashString(name) % GRADIENTS.length];
  const building = buildingId ? BUILDINGS[buildingId] : undefined;

  if (building) {
    return (
      <Avatar className={className} style={{ backgroundColor: color ?? DEFAULT_AVATAR_COLOR }}>
        <AvatarImage src={building.image} alt={building.name} className="object-contain p-[12%]" />
        {/* If the SVG fails to load, show initials over the color chip, not an empty avatar. */}
        <AvatarFallback className="bg-transparent text-white/95">{initials}</AvatarFallback>
      </Avatar>
    );
  }

  return (
    <Avatar className={className}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback style={{ backgroundImage: gradient }} className="text-white/95">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

export { Avatar, AvatarImage, AvatarFallback, IdentityAvatar };
