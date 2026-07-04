import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { currentUser } from "./users";

/**
 * How long a heartbeat keeps a session "playing" (and, reused by friends.list,
 * how long a signed-in user counts as "online"). Must exceed 2× the client
 * ping interval (45s).
 */
export const ACTIVE_WINDOW_MS = 100_000;
/** Bounded read cap for the live count (per Convex guidelines — never scan unbounded). */
const PLAYING_CAP = 500;
/** Rows older than this are eligible for pruning. */
const STALE_AFTER_MS = 600_000; // 10 min
/** Per-transaction delete batch size for the prune cron. */
const PRUNE_BATCH = 200;

/**
 * Heartbeat from an open browser tab (guests included). Upserts the session's
 * last-seen timestamp, and — for signed-in users — also stamps lastActiveAt
 * on their user row so friends.list can derive online/offline. Called on
 * mount and every ~45s while the tab is visible.
 */
export const ping = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const id = sessionId.trim().slice(0, 64);
    const now = Date.now();

    const me = await currentUser(ctx);
    if (me) await ctx.db.patch(me._id, { lastActiveAt: now });

    if (!id) return null;
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_session", (q) => q.eq("sessionId", id))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: now });
    } else {
      await ctx.db.insert("presence", { sessionId: id, lastSeenAt: now });
    }
    return null;
  },
});

/**
 * Homepage stats in one subscription: how many sessions are currently active,
 * and the all-time total player count (denormalized counter in appStats).
 */
export const homeStats = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - ACTIVE_WINDOW_MS;
    const active = await ctx.db
      .query("presence")
      .withIndex("by_lastSeen", (q) => q.gt("lastSeenAt", cutoff))
      .take(PLAYING_CAP);
    // `.first()` (not `.unique()`): the homepage read must never throw, even in
    // the unlikely case a pre-seed insert race left two counter rows.
    const stat = await ctx.db
      .query("appStats")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .first();
    return { playingNow: active.length, totalPlayers: stat?.totalUsers ?? 0 };
  },
});

/**
 * Delete stale presence rows so the table doesn't grow unbounded. Scheduled
 * hourly by crons.ts; self-reschedules while full batches remain to stay within
 * per-mutation transaction limits.
 */
export const prune = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - STALE_AFTER_MS;
    const stale = await ctx.db
      .query("presence")
      .withIndex("by_lastSeen", (q) => q.lt("lastSeenAt", cutoff))
      .take(PRUNE_BATCH);
    for (const row of stale) {
      await ctx.db.delete(row._id);
    }
    if (stale.length === PRUNE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.presence.prune, {});
    }
  },
});

/**
 * One-time backfill: seed the denormalized total-users counter from the current
 * users table. Run once after deploy: `npx convex run presence:seedUserCount`.
 * ensureUser keeps it accurate thereafter.
 */
export const seedUserCount = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").take(10_000);
    const stat = await ctx.db
      .query("appStats")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .first();
    if (stat) await ctx.db.patch(stat._id, { totalUsers: users.length });
    else await ctx.db.insert("appStats", { key: "global", totalUsers: users.length });
    return users.length;
  },
});
