/**
 * English UI strings — the source of truth for every other locale.
 *
 * Keys are flat, dotted namespaces. `satisfies Record<string, string>` keeps the
 * literal key union (so `TKey = keyof typeof en` stays precise) while checking
 * every value is a string. Other locales are typed against these keys.
 *
 * Use `{name}`-style placeholders for interpolation (see `translate`).
 */
export const en = {
  // Navigation / header
  "nav.maps": "Maps",
  "nav.leaderboard": "Leaderboard",
  "nav.friends": "Friends",
  "nav.stats": "Stats",
  "nav.play": "Play",

  // Auth
  "auth.signIn": "Sign in",
  "auth.signUp": "Sign up",
  "auth.signOut": "Sign out",
  "auth.signInTooltip": "Save your progress, climb the leaderboard, and play with friends",

  // Settings menu
  "settings.title": "Settings",
  "settings.open": "Settings",
  "settings.theme": "Theme",
  "settings.theme.system": "System",
  "settings.theme.light": "Light",
  "settings.theme.dark": "Dark",
  "settings.language": "Language",
  "settings.mapType": "Map type",
  "settings.mapType.normal": "Normal",
  "settings.mapType.satellite": "Satellite",
  "settings.mapType.terrain": "Terrain",
  "settings.mapType.hybrid": "Hybrid",

  // Game
  "round.counter": "Round {current} of {total}",

  // Friends
  "friends.title": "Friends",
  "friends.subtitle": "Add players and start private matches",
  "friends.signInToManage": "Sign in to manage friends.",
  "friends.signIn": "Sign in",
  "friends.removed": "Removed",
  "friends.couldNotRemove": "Could not remove friend",
  "friends.requestSentTo": "Request sent to {name}",
  "friends.couldNotSendRequest": "Could not send request",
  "friends.requestWithdrawn": "Request withdrawn",
  "friends.couldNotWithdrawRequest": "Could not withdraw request",
  "friends.usernamePlaceholder": "e.g. mapmaster",
  "friends.add": "Add",
  "friends.requests": "Requests",
  "friends.accept": "Accept",
  "friends.decline": "Decline",
  "friends.yourFriends": "Your friends",
  "friends.noFriends": "No friends yet — add someone above.",
  "friends.remove": "Remove",
  "friends.pendingSent": "Pending sent",
  "friends.pending": "Pending…",
  "friends.cancel": "Cancel",
  "friends.recentPlayers": "Recent players",
  "friends.removeConfirmTitle": "Remove friend?",
  "friends.removeConfirmDescription": "You'll need to send a new request to add them again.",

  // Maps
  "maps.byAuthor": "by {author}",
  "maps.private": "Private",
  "maps.play": "Play",
  "maps.deleteMap": "Delete map",
  "maps.mapDeleted": "Map deleted",
  "maps.deleteFailed": "Could not delete map",
  "maps.title": "Custom maps",
  "maps.subtitle": "Play community maps or craft your own",
  "maps.create": "Create",
  "maps.yourMaps": "Your maps",
  "maps.communityMaps": "Community maps",
  "maps.noCommunityMaps": "No community maps yet — be the first to create one.",
  "maps.deleteDialogTitle": "Delete map?",
  "maps.deleteDialogDescription": "This permanently deletes this map and its locations. This can't be undone.",
  "maps.deleteConfirm": "Delete",
  "maps.mapUnavailable": "Map unavailable",
  "maps.mapUnavailableDescription": "This map is private or doesn't have enough locations.",
  "maps.browseMaps": "Browse maps",

  // Leaderboard
  "leaderboard.title": "Leaderboard",
  "leaderboard.rankedByXp": "Ranked by XP",
  "leaderboard.global": "Global",
  "leaderboard.friends": "Friends",
  "leaderboard.scopeAria": "Leaderboard scope",
  "leaderboard.you": "You",
  "leaderboard.levelGames": "Level {level} · {games} games",
  "leaderboard.noFriendsRanked": "No ranked friends yet. Add friends to see them here.",
  "leaderboard.friendsSignedOut": "Sign in and add friends to see them ranked here.",
  "leaderboard.noPlayersRanked": "No ranked players yet. Be the first.",
  "leaderboard.yourRank": "Your rank",

  // Profile
  "profile.saveName": "Save name",
  "profile.editName": "Edit name",
  "profile.statsOnDevice": "Stats saved on this device",
  "profile.recentGames": "Recent games",
  "profile.playerNotFound": "Player not found",
  "profile.noPlayerNamed": "No one plays under “{username}”.",
  "profile.levelJoined": "Level {level} · joined {joined}",

  // Multiplayer
  "mp.host": "Host",
  "mp.disconnected": "Disconnected",
  "mp.ready": "Ready",
  "mp.notReady": "Not ready",
  "mp.movementMoving": "Moving",
  "mp.hintToast": "Search area shown on the map · {continent}",
  "mp.waitingForPlayers": "Waiting for other players…",
  "mp.nextRoundIn": "Next round in {seconds}s",
  "mp.noGuess": "No guess",
  "mp.finalResults": "Final results",
  "mp.wins": "wins",
  "mp.pointsValue": "{points} points",
  "mp.rematch": "Rematch",
  "mp.leave": "Leave",
  "mp.waitingForHost": "Waiting for the host to start a rematch…",

  // Generic / shared
  "common.loading": "Loading…",
  "common.back": "Back",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.close": "Close",
} satisfies Record<string, string>;

export type EnDictionary = typeof en;

/** Every translatable UI key (from the English source of truth). */
export type TKey = keyof EnDictionary;

/** A locale dictionary; keys may be omitted during rollout (English fallback). */
export type LocaleDictionary = Partial<Record<TKey, string>>;
