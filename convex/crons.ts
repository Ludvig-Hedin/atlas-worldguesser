import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sweep stale presence heartbeats hourly so the table stays small.
crons.interval("prune stale presence", { hours: 1 }, internal.presence.prune, {});

// Re-stamp every user's XP-at-period-start for the "This Week"/"This Month"
// leaderboards. Weekly is a rolling 7-day interval (not ISO-week-aligned —
// doesn't matter for a casual board); monthly uses a real calendar boundary
// since a fixed-hours interval would drift across months of different length.
crons.interval("weekly xp snapshot", { hours: 24 * 7 }, internal.leaderboard.snapshotPeriod, {
  period: "week",
});
crons.cron("monthly xp snapshot", "0 0 1 * *", internal.leaderboard.snapshotPeriod, {
  period: "month",
});

export default crons;
