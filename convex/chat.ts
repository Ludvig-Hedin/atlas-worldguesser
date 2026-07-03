import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { currentUser, requireUser } from "./users";
import { rateLimit } from "./rateLimit";

async function assertMember(ctx: QueryCtx | MutationCtx, roomId: Id<"rooms">, userId: Id<"users">) {
  const member = await ctx.db
    .query("roomMembers")
    .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", userId))
    .unique();
  if (!member) throw new Error("You're not in this room");
}

export const send = mutation({
  args: { roomId: v.id("rooms"), text: v.string() },
  handler: async (ctx, { roomId, text }) => {
    const user = await requireUser(ctx);
    await assertMember(ctx, roomId, user._id);
    await rateLimit(ctx, "chat", user._id);
    const clean = text.trim().slice(0, 300);
    if (!clean) return;
    await ctx.db.insert("chatMessages", {
      roomId,
      userId: user._id,
      username: user.username,
      text: clean,
      createdAt: Date.now(),
    });
  },
});

export const list = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    // Members only — room ids are resolvable from public codes, and chat in a
    // private room shouldn't be world-readable. Return [] (not throw) so the
    // panel renders empty while auth/provisioning settles, then goes live.
    const user = await currentUser(ctx);
    if (!user) return [];
    const member = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", user._id))
      .unique();
    if (!member) return [];
    const msgs = await ctx.db
      .query("chatMessages")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .order("desc")
      .take(60);
    return msgs
      .reverse()
      .map((m) => ({ _id: m._id, userId: m.userId, username: m.username, text: m.text, createdAt: m.createdAt }));
  },
});
