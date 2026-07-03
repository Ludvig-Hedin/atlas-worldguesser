import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sweep stale presence heartbeats hourly so the table stays small.
crons.interval("prune stale presence", { hours: 1 }, internal.presence.prune, {});

export default crons;
