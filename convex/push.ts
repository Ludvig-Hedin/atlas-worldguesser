import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { requireUser } from "./users";

const keysValidator = v.object({ p256dh: v.string(), auth: v.string() });

/**
 * Upsert-by-endpoint: re-subscribing (e.g. after a permission re-grant, or the
 * browser rotating its endpoint) replaces the old row instead of accumulating
 * duplicates. A user can hold several rows (one per device/browser).
 */
export const subscribe = mutation({
  args: { endpoint: v.string(), keys: keysValidator },
  handler: async (ctx, { endpoint, keys }) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { userId: user._id, keys });
      return;
    }
    await ctx.db.insert("pushSubscriptions", {
      userId: user._id,
      endpoint,
      keys,
      createdAt: Date.now(),
    });
  },
});

export const unsubscribe = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();
    if (existing && existing.userId === user._id) await ctx.db.delete(existing._id);
  },
});

/** Whether the current device's subscription (by endpoint) is still registered server-side. */
export const isSubscribed = query({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();
    return !!existing && existing.userId === user._id;
  },
});

/** Internal: read by the Node action (convex/pushSend.ts) — actions can't use ctx.db directly. */
export const listForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

/** Internal: drop a subscription the push service reports as gone (404/410). */
export const remove = internalMutation({
  args: { id: v.id("pushSubscriptions") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
