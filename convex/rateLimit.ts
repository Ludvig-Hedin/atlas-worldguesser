import type { MutationCtx } from "./_generated/server";

const MINUTE = 60_000;
const DAY = 86_400_000;

/** Per-user, per-action limits — the cost/abuse guardrails. */
export const LIMITS = {
  roomCreate: { max: 10, windowMs: DAY },
  roomJoin: { max: 60, windowMs: MINUTE },
  guess: { max: 120, windowMs: MINUTE },
  chat: { max: 30, windowMs: MINUTE },
  friendRequest: { max: 30, windowMs: DAY },
  mapCreate: { max: 10, windowMs: DAY },
  soloRecord: { max: 300, windowMs: DAY },
  dailyRecord: { max: 20, windowMs: DAY },
  flagRecord: { max: 300, windowMs: DAY },
  partyInvite: { max: 60, windowMs: MINUTE },
  roomInvite: { max: 60, windowMs: MINUTE },
  mapLike: { max: 60, windowMs: MINUTE },
} as const;

/**
 * Fixed-window rate limit. Throws a friendly error when the subject exceeds
 * `max` actions within `windowMs`. Cheap: one indexed read + one write.
 */
export async function rateLimit(
  ctx: MutationCtx,
  action: keyof typeof LIMITS,
  subject: string,
): Promise<void> {
  const { max, windowMs } = LIMITS[action];
  const key = `${action}:${subject}`;
  const now = Date.now();
  const row = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  if (!row) {
    await ctx.db.insert("rateLimits", { key, count: 1, windowStart: now });
    return;
  }
  if (now - row.windowStart >= windowMs) {
    await ctx.db.patch(row._id, { count: 1, windowStart: now });
    return;
  }
  if (row.count >= max) {
    throw new Error("You're doing that too often. Take a short break and try again.");
  }
  await ctx.db.patch(row._id, { count: row.count + 1 });
}
