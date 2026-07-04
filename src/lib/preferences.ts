/**
 * Device-local UI preferences: colour theme, interface language, and basemap
 * type. Persisted to localStorage (same pattern as `last-game` / `local-profile`)
 * — these are per-device display choices, not synced to the backend.
 */

export type Theme = "system" | "light" | "dark";
export type Locale = "en" | "sv" | "pl" | "uk" | "lt";
export type MapType = "normal" | "satellite" | "terrain" | "hybrid";

export interface Preferences {
  theme: Theme;
  locale: Locale;
  mapType: MapType;
  /** Play sound effects (right/wrong, menu clicks). */
  sound: boolean;
  /** Use dark map tiles for the normal basemap when the resolved theme is dark. */
  darkMap: boolean;
}

export const THEMES: readonly Theme[] = ["system", "light", "dark"] as const;
export const LOCALE_CODES: readonly Locale[] = ["en", "sv", "pl", "uk", "lt"] as const;
export const MAP_TYPES: readonly MapType[] = [
  "normal",
  "satellite",
  "terrain",
  "hybrid",
] as const;

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  locale: "en",
  mapType: "normal",
  sound: true,
  darkMap: true,
};

const KEY = "atlas:prefs:v1";

function isTheme(v: unknown): v is Theme {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}
function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALE_CODES as readonly string[]).includes(v);
}
function isMapType(v: unknown): v is MapType {
  return typeof v === "string" && (MAP_TYPES as readonly string[]).includes(v);
}

/** Read preferences, falling back to defaults for missing/corrupt/invalid fields. */
export function loadPreferences(): Preferences {
  if (typeof window === "undefined") return { ...DEFAULT_PREFERENCES };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      theme: isTheme(parsed.theme) ? parsed.theme : DEFAULT_PREFERENCES.theme,
      locale: isLocale(parsed.locale) ? parsed.locale : DEFAULT_PREFERENCES.locale,
      mapType: isMapType(parsed.mapType) ? parsed.mapType : DEFAULT_PREFERENCES.mapType,
      sound: typeof parsed.sound === "boolean" ? parsed.sound : DEFAULT_PREFERENCES.sound,
      darkMap: typeof parsed.darkMap === "boolean" ? parsed.darkMap : DEFAULT_PREFERENCES.darkMap,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(prefs: Preferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // storage full / disabled — non-fatal
  }
}

/**
 * Resolve a theme choice to the concrete appearance to paint. `system` reads the
 * OS preference; on the server (no `matchMedia`) it resolves to `dark` to match
 * the historical default and the no-flash script's fallback.
 */
export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "light" || theme === "dark") return theme;
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
