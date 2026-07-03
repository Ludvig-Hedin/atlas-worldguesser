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
