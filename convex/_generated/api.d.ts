/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as chat from "../chat.js";
import type * as crons from "../crons.js";
import type * as dailyChallenge from "../dailyChallenge.js";
import type * as email from "../email.js";
import type * as flags from "../flags.js";
import type * as friends from "../friends.js";
import type * as gameLogic from "../gameLogic.js";
import type * as games from "../games.js";
import type * as leaderboard from "../leaderboard.js";
import type * as maps from "../maps.js";
import type * as parties from "../parties.js";
import type * as presence from "../presence.js";
import type * as rateLimit from "../rateLimit.js";
import type * as rooms from "../rooms.js";
import type * as solo from "../solo.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  chat: typeof chat;
  crons: typeof crons;
  dailyChallenge: typeof dailyChallenge;
  email: typeof email;
  flags: typeof flags;
  friends: typeof friends;
  gameLogic: typeof gameLogic;
  games: typeof games;
  leaderboard: typeof leaderboard;
  maps: typeof maps;
  parties: typeof parties;
  presence: typeof presence;
  rateLimit: typeof rateLimit;
  rooms: typeof rooms;
  solo: typeof solo;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
