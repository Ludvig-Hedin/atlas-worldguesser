import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { settingsValidator } from "./schema";
import { currentUser, requireUser } from "./users";
import { rateLimit } from "./rateLimit";
import { areFriends } from "./friends";
import { assertMultiplayerEnabled, createRoomForUser } from "./rooms";

/**
 * Parties: persistent friend groups. A user is `joined` to at most one party;
 * `invited` rows are pending invitations. The leader starts a room and stamps
 * `activeRoomCode` on the party so members can one-click-join the same lobby.
 */

const MAX_PARTY = 8;

async function membershipsOf(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  // Bounded: a user has at most one joined party but can accumulate pending
  // invites; cap the read so a spammed inbox can't blow query limits.
  return await ctx.db
    .query("partyMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(50);
}

async function membersOfParty(ctx: QueryCtx | MutationCtx, partyId: Id<"parties">) {
  return await ctx.db
    .query("partyMembers")
    .withIndex("by_party", (q) => q.eq("partyId", partyId))
    .collect();
}

/** After a member leaves, reassign leadership or tear the party down if empty. */
async function reconcileParty(
  ctx: MutationCtx,
  partyId: Id<"parties">,
  leftUserId: Id<"users">,
) {
  const party = await ctx.db.get(partyId);
  if (!party) return;
  const all = await membersOfParty(ctx, partyId);
  const joined = all.filter((m) => m.status === "joined");
  if (joined.length === 0) {
    // No joined members left — drop pending invites and the party itself.
    for (const m of all) await ctx.db.delete(m._id);
    await ctx.db.delete(partyId);
    return;
  }
  if (party.leaderId === leftUserId) {
    await ctx.db.patch(partyId, { leaderId: joined[0].userId });
  }
}

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const me = await currentUser(ctx);
    if (!me) return { party: null, invites: [], myUserId: null };
    const rows = await membershipsOf(ctx, me._id);
    const joined = rows.find((r) => r.status === "joined");

    const invites: { partyId: Id<"parties">; leaderName: string }[] = [];
    for (const r of rows.filter((r) => r.status === "invited")) {
      const p = await ctx.db.get(r.partyId);
      if (!p) continue;
      const leader = await ctx.db.get(p.leaderId);
      invites.push({ partyId: r.partyId, leaderName: leader?.username ?? "A player" });
    }

    let party = null;
    if (joined) {
      const p = await ctx.db.get(joined.partyId);
      if (p) {
        const members = await membersOfParty(ctx, p._id);
        // Only surface the room while it's still joinable (lobby). Once it
        // starts/finishes the "Join room" button must disappear so members
        // don't land on a blocked/spectator screen for a dead room.
        let activeRoomCode: string | null = null;
        if (p.activeRoomCode) {
          const room = await ctx.db
            .query("rooms")
            .withIndex("by_code", (q) => q.eq("code", p.activeRoomCode!))
            .unique();
          if (room && room.status === "lobby") activeRoomCode = p.activeRoomCode;
        }
        party = {
          _id: p._id,
          leaderId: p.leaderId,
          amLeader: p.leaderId === me._id,
          activeRoomCode,
          members: members.map((m) => ({
            userId: m.userId,
            username: m.username,
            status: m.status,
            isLeader: m.userId === p.leaderId,
          })),
        };
      }
    }
    return { party, invites, myUserId: me._id };
  },
});

export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const existing = (await membershipsOf(ctx, user._id)).find((r) => r.status === "joined");
    if (existing) return existing.partyId; // already in a party — idempotent
    const partyId = await ctx.db.insert("parties", { leaderId: user._id, createdAt: Date.now() });
    await ctx.db.insert("partyMembers", {
      partyId,
      userId: user._id,
      username: user.username,
      status: "joined",
      createdAt: Date.now(),
    });
    return partyId;
  },
});

export const invite = mutation({
  args: { partyId: v.id("parties"), friendId: v.id("users") },
  handler: async (ctx, { partyId, friendId }) => {
    const user = await requireUser(ctx);
    await rateLimit(ctx, "partyInvite", user._id);
    const party = await ctx.db.get(partyId);
    if (!party) throw new Error("Party not found");
    if (party.leaderId !== user._id) throw new Error("Only the party leader can invite");
    if (!(await areFriends(ctx, user._id, friendId))) throw new Error("You can only invite friends");
    const members = await membersOfParty(ctx, partyId);
    if (members.length >= MAX_PARTY) throw new Error("This party is full");
    if (members.some((m) => m.userId === friendId)) return; // already invited/joined
    const friend = await ctx.db.get(friendId);
    if (!friend) throw new Error("Player not found");
    await ctx.db.insert("partyMembers", {
      partyId,
      userId: friendId,
      username: friend.username,
      status: "invited",
      invitedBy: user._id,
      createdAt: Date.now(),
    });
  },
});

export const respond = mutation({
  args: { partyId: v.id("parties"), accept: v.boolean() },
  handler: async (ctx, { partyId, accept }) => {
    const user = await requireUser(ctx);
    const row = await ctx.db
      .query("partyMembers")
      .withIndex("by_party_user", (q) => q.eq("partyId", partyId).eq("userId", user._id))
      .unique();
    if (!row || row.status !== "invited") throw new Error("No invitation to this party");
    if (!accept) {
      await ctx.db.delete(row._id);
      return;
    }
    // Accepting a new party leaves any party you're currently joined in.
    const others = (await membershipsOf(ctx, user._id)).filter(
      (r) => r._id !== row._id && r.status === "joined",
    );
    for (const o of others) {
      await ctx.db.delete(o._id);
      await reconcileParty(ctx, o.partyId, user._id);
    }
    await ctx.db.patch(row._id, { status: "joined" });
  },
});

export const leave = mutation({
  args: { partyId: v.id("parties") },
  handler: async (ctx, { partyId }) => {
    const user = await requireUser(ctx);
    const row = await ctx.db
      .query("partyMembers")
      .withIndex("by_party_user", (q) => q.eq("partyId", partyId).eq("userId", user._id))
      .unique();
    if (!row) return;
    await ctx.db.delete(row._id);
    await reconcileParty(ctx, partyId, user._id);
  },
});

export const startRoom = mutation({
  args: {
    partyId: v.id("parties"),
    mapId: v.string(),
    settings: settingsValidator,
    teamMode: v.optional(v.boolean()),
  },
  handler: async (ctx, { partyId, mapId, settings, teamMode }) => {
    assertMultiplayerEnabled();
    const user = await requireUser(ctx);
    await rateLimit(ctx, "roomCreate", user._id);
    const party = await ctx.db.get(partyId);
    if (!party) throw new Error("Party not found");
    if (party.leaderId !== user._id) throw new Error("Only the party leader can start a room");
    const { code } = await createRoomForUser(ctx, user, mapId, settings, teamMode);
    await ctx.db.patch(partyId, { activeRoomCode: code });
    return { code };
  },
});
