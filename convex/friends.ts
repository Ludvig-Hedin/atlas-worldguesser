import { v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { currentUser, requireUser } from "./users";

async function findPair(
  ctx: QueryCtx | MutationCtx,
  a: Id<"users">,
  b: Id<"users">,
): Promise<Doc<"friends"> | null> {
  const ab = await ctx.db
    .query("friends")
    .withIndex("by_pair", (q) => q.eq("userId", a).eq("friendId", b))
    .unique();
  if (ab) return ab;
  return await ctx.db
    .query("friends")
    .withIndex("by_pair", (q) => q.eq("userId", b).eq("friendId", a))
    .unique();
}

export const sendRequest = mutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const me = await requireUser(ctx);
    const target = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("usernameLower", username.toLowerCase()))
      .unique();
    if (!target) throw new Error("No player with that username");
    if (target._id === me._id) throw new Error("You can't add yourself");
    const existing = await findPair(ctx, me._id, target._id);
    if (existing) {
      throw new Error(existing.status === "accepted" ? "Already friends" : "Request already pending");
    }
    await ctx.db.insert("friends", {
      userId: me._id,
      friendId: target._id,
      status: "pending",
      requestedBy: me._id,
      createdAt: Date.now(),
    });
  },
});

export const respond = mutation({
  args: { requestId: v.id("friends"), accept: v.boolean() },
  handler: async (ctx, { requestId, accept }) => {
    const me = await requireUser(ctx);
    const row = await ctx.db.get(requestId);
    if (!row || row.friendId !== me._id || row.status !== "pending") {
      throw new Error("No such request");
    }
    if (accept) await ctx.db.patch(requestId, { status: "accepted" });
    else await ctx.db.delete(requestId);
  },
});

export const remove = mutation({
  args: { friendId: v.id("users") },
  handler: async (ctx, { friendId }) => {
    const me = await requireUser(ctx);
    const row = await findPair(ctx, me._id, friendId);
    if (row) await ctx.db.delete(row._id);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const me = await currentUser(ctx);
    if (!me) return { friends: [], incoming: [], outgoing: [] };

    const [asUser, asFriend] = await Promise.all([
      ctx.db.query("friends").withIndex("by_user", (q) => q.eq("userId", me._id)).collect(),
      ctx.db.query("friends").withIndex("by_friend", (q) => q.eq("friendId", me._id)).collect(),
    ]);

    const hydrate = async (id: Id<"users">) => {
      const u = await ctx.db.get(id);
      return u ? { _id: u._id, username: u.username, avatarUrl: u.avatarUrl, xp: u.xp } : null;
    };

    const friends: NonNullable<Awaited<ReturnType<typeof hydrate>>>[] = [];
    const incoming: { requestId: Id<"friends">; user: NonNullable<Awaited<ReturnType<typeof hydrate>>> }[] = [];
    const outgoing: { requestId: Id<"friends">; user: NonNullable<Awaited<ReturnType<typeof hydrate>>> }[] = [];

    for (const row of [...asUser, ...asFriend]) {
      const otherId = row.userId === me._id ? row.friendId : row.userId;
      const other = await hydrate(otherId);
      if (!other) continue;
      if (row.status === "accepted") friends.push(other);
      else if (row.requestedBy === me._id) outgoing.push({ requestId: row._id, user: other });
      else incoming.push({ requestId: row._id, user: other });
    }
    return { friends, incoming, outgoing };
  },
});
