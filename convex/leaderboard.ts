import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { levelForXp } from "../src/lib/xp";
import { DEFAULT_RATING, tierForRating } from "../src/lib/rating";
import { currentUser } from "./users";

const periodValidator = v.union(v.literal("week"), v.literal("month"));

function row(u: Doc<"users">, rank: number) {
  return {
    rank,
    _id: u._id,
    username: u.username,
    avatarUrl: u.avatarUrl,
    avatarBuildingId: u.avatarBuildingId,
    avatarColor: u.avatarColor,
    xp: u.xp,
    level: levelForXp(u.xp),
    gamesPlayed: u.stats.gamesPlayed,
    wins: u.stats.wins,
  };
}

/** Global leaderboard by XP. */
export const top = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    // Clamp both ends — a client-sent negative/NaN limit would make .take() throw.
    const n = Math.max(1, Math.min(Math.floor(limit ?? 50) || 50, 100));
    // Guests accrue XP mid-match and are interleaved in the by_xp index, but must
    // never appear on the persistent (all-time) board. Over-fetch a bounded
    // margin, drop guest rows, then slice to n. If an implausible number of
    // high-XP guests ever crowd the window the board simply shows fewer rows —
    // it never leaks a guest.
    const pool = Math.min(n + 150, 500);
    const users = (await ctx.db.query("users").withIndex("by_xp").order("desc").take(pool))
      .filter((u) => !u.isGuest)
      .slice(0, n);
    // Competition ranking (ties share a rank) so this list agrees with
    // myRank's "(# strictly higher) + 1" for tied XP values.
    const rows: ReturnType<typeof row>[] = [];
    for (let i = 0; i < users.length; i++) {
      const rank = i > 0 && users[i].xp === users[i - 1].xp ? rows[i - 1].rank : i + 1;
      rows.push(row(users[i], rank));
    }
    return rows;
  },
});

function ratingRow(u: Doc<"users">, rank: number) {
  const rating = u.rating ?? DEFAULT_RATING;
  return {
    rank,
    _id: u._id,
    username: u.username,
    avatarUrl: u.avatarUrl,
    avatarBuildingId: u.avatarBuildingId,
    avatarColor: u.avatarColor,
    rating,
    tier: tierForRating(rating).key,
    level: levelForXp(u.xp),
    gamesPlayed: u.stats.gamesPlayed,
    wins: u.stats.wins,
  };
}

/**
 * Global ranked-rating leaderboard. Mirrors `top` but ordered by the by_rating
 * index and restricted to players who have actually played a rated match
 * (rating !== undefined) — which naturally excludes guests (they never accrue
 * rating) and everyone still on the default 1000 they've never earned.
 */
export const topRated = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const n = Math.max(1, Math.min(Math.floor(limit ?? 50) || 50, 100));
    // by_rating sorts undefined-rating rows lowest, so `.order("desc")` puts the
    // real rated players first; over-fetch a margin, drop guests + never-rated
    // rows, then slice to n (same shape as `top`).
    const pool = Math.min(n + 150, 500);
    const users = (await ctx.db.query("users").withIndex("by_rating").order("desc").take(pool))
      .filter((u) => !u.isGuest && u.rating !== undefined)
      .slice(0, n);
    // Competition ranking (ties share a rank), matching `top`.
    const rows: ReturnType<typeof ratingRow>[] = [];
    for (let i = 0; i < users.length; i++) {
      const rank = i > 0 && users[i].rating === users[i - 1].rating ? rows[i - 1].rank : i + 1;
      rows.push(ratingRow(users[i], rank));
    }
    return rows;
  },
});

/**
 * The signed-in user's own leaderboard row + global rank, so players outside
 * the top N still see where they stand. Null for guests / unranked users.
 * Rank = (# of users with strictly higher XP) + 1.
 */
export const myRank = query({
  args: {},
  handler: async (ctx) => {
    const me = await currentUser(ctx);
    // Guests (no Clerk identity) never resolve here, but guard defensively so a
    // guest can never be ranked on the persistent board.
    if (!me || me.isGuest) return null;
    // Bounded read: `.collect()` would materialize every higher-XP user and
    // can blow Convex's per-query read limits for low-ranked players. Past
    // the cap the rank is reported as RANK_CAP + 1 ("you're way down there").
    // TODO(bug-hunt): switch to a maintained count (@convex-dev/aggregate)
    // if the user base outgrows this.
    const RANK_CAP = 5000;
    const higher = await ctx.db
      .query("users")
      .withIndex("by_xp", (q) => q.gt("xp", me.xp))
      .take(RANK_CAP);
    // Exclude guests so this rank stays consistent with `top` (which drops them).
    const higherReal = higher.filter((u) => !u.isGuest).length;
    return row(me, higherReal + 1);
  },
});

/** Leaderboard scoped to the signed-in user's accepted friends (plus themselves). */
export const friends = query({
  args: {},
  handler: async (ctx) => {
    const me = await currentUser(ctx);
    if (!me) return [];
    const [asUser, asFriend] = await Promise.all([
      ctx.db.query("friends").withIndex("by_user", (q) => q.eq("userId", me._id)).collect(),
      ctx.db.query("friends").withIndex("by_friend", (q) => q.eq("friendId", me._id)).collect(),
    ]);
    const ids = new Set<Id<"users">>([me._id]);
    for (const r of [...asUser, ...asFriend]) {
      if (r.status !== "accepted") continue;
      ids.add(r.userId === me._id ? r.friendId : r.userId);
    }
    const users = (await Promise.all([...ids].map((id) => ctx.db.get(id)))).filter(
      (u): u is Doc<"users"> => u !== null,
    );
    users.sort((a, b) => b.xp - a.xp);
    return users.map((u, i) => row(u, i + 1));
  },
});

/**
 * (Re)stamp every user's XP-at-period-start. Scheduled weekly/monthly by
 * crons.ts. Self-reschedules across batches so one call never reads/writes
 * more than a page of users (Convex mutation transaction limits). Overwrites
 * the existing row for this period rather than inserting a new one each
 * time — this table stays O(active users), not O(users × periods elapsed).
 */
const SNAPSHOT_BATCH = 200;

export const snapshotPeriod = internalMutation({
  args: { period: periodValidator, cursor: v.optional(v.string()) },
  handler: async (ctx, { period, cursor }) => {
    const now = Date.now();
    const page = await ctx.db.query("users").paginate({ numItems: SNAPSHOT_BATCH, cursor: cursor ?? null });
    for (const user of page.page) {
      const existing = await ctx.db
        .query("xpSnapshots")
        .withIndex("by_user_period", (q) => q.eq("userId", user._id).eq("period", period))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { periodStart: now, xpAtStart: user.xp });
      } else {
        await ctx.db.insert("xpSnapshots", { userId: user._id, period, periodStart: now, xpAtStart: user.xp });
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.leaderboard.snapshotPeriod, {
        period,
        cursor: page.continueCursor,
      });
    }
  },
});

function periodRow(user: Doc<"users">, gain: number, rank: number) {
  return {
    rank,
    _id: user._id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    avatarBuildingId: user.avatarBuildingId,
    avatarColor: user.avatarColor,
    xp: user.xp,
    gain,
    level: levelForXp(user.xp),
    gamesPlayed: user.stats.gamesPlayed,
  };
}

/**
 * "This Week" / "This Month" leaderboard, ranked by XP gained SINCE the
 * period's last snapshot (not lifetime XP) — so a brand-new player can
 * outrank a veteran within the window instead of being locked out forever by
 * the all-time board. The very first period after this feature ships has no
 * prior baseline: everyone's snapshot starts at their current XP, so that
 * first window's "gain" is 0 for anyone who hasn't played since — expected,
 * not backfilled.
 *
 * Bounded scan (same accepted tradeoff as `top`'s TODO): reads up to
 * SCAN_LIMIT snapshot rows and ranks in memory. Fine at this project's scale;
 * revisit with a maintained aggregate if the user base outgrows it.
 */
const SCAN_LIMIT = 500;

// TODO(bug-hunt): only users with an xpSnapshots row for `period` are
// considered — that row is only created by the weekly/monthly cron
// (snapshotPeriod). Anyone who signs up after the last cron run has no
// snapshot and is silently excluded from this board for the rest of the
// period (up to 7 days for "week"), even with huge XP gains — the opposite
// of the "new player can outrank a veteran" goal above. Needs a decision:
// seed a 0-XP snapshot at account creation (ensureUser/ensureGuestUser), or
// have this query treat a missing snapshot as baseline 0 by scanning `users`
// instead of `xpSnapshots`.
export const topPeriod = query({
  args: { period: periodValidator, limit: v.optional(v.number()) },
  handler: async (ctx, { period, limit }) => {
    const n = Math.max(1, Math.min(Math.floor(limit ?? 50) || 50, 100));
    const snapshots = await ctx.db
      .query("xpSnapshots")
      .withIndex("by_period", (q) => q.eq("period", period))
      .take(SCAN_LIMIT);

    const gains: { user: Doc<"users">; gain: number }[] = [];
    for (const snap of snapshots) {
      const user = await ctx.db.get(snap.userId);
      if (!user || user.isGuest) continue;
      gains.push({ user, gain: Math.max(0, user.xp - snap.xpAtStart) });
    }
    gains.sort((a, b) => b.gain - a.gain);
    const topGains = gains.slice(0, n);

    const rows: ReturnType<typeof periodRow>[] = [];
    for (let i = 0; i < topGains.length; i++) {
      const rank =
        i > 0 && topGains[i].gain === topGains[i - 1].gain ? rows[i - 1].rank : i + 1;
      rows.push(periodRow(topGains[i].user, topGains[i].gain, rank));
    }
    return rows;
  },
});
