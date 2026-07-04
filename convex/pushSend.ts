"use node";

import webpush, { WebPushError } from "web-push";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { absoluteUrl } from "../src/lib/seo";

const TEMPLATES = {
  friendRequest: (fromUsername: string) => ({
    title: "New friend request",
    body: `${fromUsername} wants to add you as a friend`,
    url: absoluteUrl("/friends"),
  }),
  friendAccepted: (fromUsername: string) => ({
    title: "Friend request accepted",
    body: `${fromUsername} accepted your friend request`,
    url: absoluteUrl("/friends"),
  }),
  roomInvite: (fromUsername: string, roomCode: string) => ({
    title: "Match invite",
    body: `${fromUsername} invited you to a match`,
    url: absoluteUrl(`/room/${roomCode}`),
  }),
  partyInvite: (fromUsername: string) => ({
    title: "Party invite",
    body: `${fromUsername} invited you to their party`,
    url: absoluteUrl("/party"),
  }),
} as const;

/**
 * Fan out a push notification to every subscribed device for one user.
 * Scheduled the same way as convex/email.ts (`ctx.scheduler.runAfter(0, ...)`)
 * from the same four trigger points, so the two channels stay in lockstep.
 * No-ops (with a console warning) when VAPID keys aren't configured.
 */
export const send = internalAction({
  args: {
    kind: v.union(
      v.literal("friendRequest"),
      v.literal("friendAccepted"),
      v.literal("roomInvite"),
      v.literal("partyInvite"),
    ),
    userId: v.id("users"),
    fromUsername: v.string(),
    roomCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) {
      console.warn(`[push] VAPID keys not set — skipped "${args.kind}" push for ${args.userId}`);
      return;
    }

    const subs = await ctx.runQuery(internal.push.listForUser, { userId: args.userId });
    if (subs.length === 0) return;

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:ludvig@ludvighedin.com",
      publicKey,
      privateKey,
    );

    const { title, body, url } =
      args.kind === "roomInvite"
        ? TEMPLATES.roomInvite(args.fromUsername, args.roomCode ?? "")
        : TEMPLATES[args.kind](args.fromUsername);
    const payload = JSON.stringify({ title, body, url });

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
        } catch (err) {
          const statusCode = err instanceof WebPushError ? err.statusCode : undefined;
          if (statusCode === 404 || statusCode === 410) {
            // Push service says this subscription is gone for good — drop it.
            await ctx.runMutation(internal.push.remove, { id: sub._id });
          } else {
            console.error(`[push] send failed (${statusCode ?? "?"}) for "${args.kind}":`, err);
          }
        }
      }),
    );
  },
});
