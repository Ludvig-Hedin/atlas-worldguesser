import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { currentUser, requireUser } from "./users";
import { rateLimit } from "./rateLimit";

const locationInput = v.object({
  lat: v.number(),
  lng: v.number(),
  countryCode: v.string(),
});

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `${base || "map"}-${suffix}`;
}

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isPublic: v.boolean(),
    locations: v.array(locationInput),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await rateLimit(ctx, "mapCreate", user._id);
    const name = args.name.trim().slice(0, 40);
    if (name.length < 3) throw new Error("Give your map a name (3+ characters)");
    if (args.locations.length < 5) throw new Error("Add at least 5 locations");
    if (args.locations.length > 200) throw new Error("Maps can have at most 200 locations");
    // Public maps are played by everyone — never store coordinates a real
    // click can't produce (NaN/Infinity/out-of-range breaks Street View + scoring).
    for (const loc of args.locations) {
      if (
        !Number.isFinite(loc.lat) ||
        !Number.isFinite(loc.lng) ||
        Math.abs(loc.lat) > 90 ||
        Math.abs(loc.lng) > 180
      ) {
        throw new Error("Invalid location coordinates");
      }
    }

    const slug = slugify(name);
    const mapId = await ctx.db.insert("maps", {
      slug,
      name,
      description: args.description?.trim().slice(0, 200) || undefined,
      ownerId: user._id,
      ownerName: user.username,
      isPublic: args.isPublic,
      locationCount: args.locations.length,
      createdAt: Date.now(),
    });
    for (const loc of args.locations) {
      await ctx.db.insert("mapLocations", {
        mapId,
        lat: loc.lat,
        lng: loc.lng,
        countryCode: /^[A-Za-z]{2}$/.test(loc.countryCode) ? loc.countryCode.toUpperCase() : "",
      });
    }
    return { mapId, slug };
  },
});

export const remove = mutation({
  args: { mapId: v.id("maps") },
  handler: async (ctx, { mapId }) => {
    const user = await requireUser(ctx);
    const map = await ctx.db.get(mapId);
    if (!map || map.ownerId !== user._id) throw new Error("Not your map");
    const locs = await ctx.db.query("mapLocations").withIndex("by_map", (q) => q.eq("mapId", mapId)).collect();
    for (const l of locs) await ctx.db.delete(l._id);
    await ctx.db.delete(mapId);
  },
});

function summary(map: Doc<"maps">) {
  return {
    _id: map._id,
    slug: map.slug,
    name: map.name,
    description: map.description,
    ownerName: map.ownerName,
    ownerId: map.ownerId,
    isPublic: map.isPublic,
    locationCount: map.locationCount,
    plays: map.plays ?? 0,
    likes: map.likes ?? 0,
    createdAt: map.createdAt,
  };
}

// How many public maps we scan in memory to rank by likes/plays. There's no
// maintained index for those (they change on every like/play), so this is a
// bounded scan + in-memory sort rather than an indexed query. Fine at today's
// scale; if the public map count ever dwarfs this, replace with a maintained
// "top maps" cache instead of raising the cap.
const TRENDING_SCAN_LIMIT = 300;

export const listPublic = query({
  args: { sort: v.optional(v.union(v.literal("newest"), v.literal("likes"), v.literal("plays"))) },
  handler: async (ctx, args) => {
    const sort = args.sort ?? "newest";
    if (sort === "newest") {
      const maps = await ctx.db
        .query("maps")
        .withIndex("by_public", (q) => q.eq("isPublic", true))
        .order("desc")
        .take(60);
      return maps.map(summary);
    }
    const maps = await ctx.db
      .query("maps")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .order("desc")
      .take(TRENDING_SCAN_LIMIT);
    const key = sort === "likes" ? "likes" : "plays";
    maps.sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0));
    return maps.slice(0, 60).map(summary);
  },
});

/** Toggle the current user's like on a map. Idempotent: never double-likes. */
export const toggleLike = mutation({
  args: { mapId: v.id("maps") },
  handler: async (ctx, { mapId }) => {
    const user = await requireUser(ctx);
    await rateLimit(ctx, "mapLike", user._id);
    const map = await ctx.db.get(mapId);
    if (!map) throw new Error("Map not found");

    const existing = await ctx.db
      .query("mapLikes")
      .withIndex("by_map_user", (q) => q.eq("mapId", mapId).eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(mapId, { likes: Math.max(0, (map.likes ?? 0) - 1) });
      return { liked: false, likes: Math.max(0, (map.likes ?? 0) - 1) };
    }
    await ctx.db.insert("mapLikes", { mapId, userId: user._id });
    await ctx.db.patch(mapId, { likes: (map.likes ?? 0) + 1 });
    return { liked: true, likes: (map.likes ?? 0) + 1 };
  },
});

/** Map ids the current user has liked, for rendering filled heart state. */
export const myLikedMapIds = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return [];
    const likes = await ctx.db
      .query("mapLikes")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(500);
    return likes.map((l) => l.mapId);
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return [];
    const maps = await ctx.db
      .query("maps")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .collect();
    return maps.map(summary);
  },
});

/** Map + its locations, for playing. Private maps are visible only to the owner. */
export const getWithLocations = query({
  // The id comes straight from the URL — accept any string and normalize, so
  // /maps/garbage/play renders the "not found" state instead of crashing.
  args: { mapId: v.string() },
  handler: async (ctx, args) => {
    const mapId = ctx.db.normalizeId("maps", args.mapId);
    if (!mapId) return null;
    const map = await ctx.db.get(mapId);
    if (!map) return null;
    if (!map.isPublic) {
      const user = await currentUser(ctx);
      if (!user || user._id !== map.ownerId) return null;
    }
    const locations = await ctx.db
      .query("mapLocations")
      .withIndex("by_map", (q) => q.eq("mapId", mapId))
      .collect();
    return {
      map: summary(map),
      locations: locations.map((l) => ({ lat: l.lat, lng: l.lng, countryCode: l.countryCode })),
    };
  },
});
