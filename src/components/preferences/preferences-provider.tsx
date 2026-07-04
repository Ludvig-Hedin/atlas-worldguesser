"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useSyncExternalStore } from "react";
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  resolveTheme,
  savePreferences,
  type Locale,
  type MapType,
  type Preferences,
  type Theme,
} from "@/lib/preferences";
import { setSoundEnabled } from "@/lib/sound";

interface PreferencesContextValue extends Preferences {
  setTheme: (theme: Theme) => void;
  setLocale: (locale: Locale) => void;
  setMapType: (mapType: MapType) => void;
  setSound: (sound: boolean) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const STORAGE_KEY = "atlas:prefs:v1";

// Module-level snapshot so `getSnapshot` returns a stable reference between
// changes (required by useSyncExternalStore) and preferences stay in sync across
// every consumer and browser tab.
let snapshot: Preferences | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): Preferences {
  if (snapshot === null) snapshot = loadPreferences();
  return snapshot;
}

function getServerSnapshot(): Preferences {
  return DEFAULT_PREFERENCES;
}

function emit() {
  for (const listener of listeners) listener();
}

function setSnapshot(next: Preferences) {
  snapshot = next;
  savePreferences(next);
  emit();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      snapshot = loadPreferences();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Reflect the chosen theme onto <html> (class drives the CSS palette). */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const resolved = resolveTheme(theme);
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

/**
 * Holds the user's device-local preferences and applies them to the document.
 *
 * Backed by useSyncExternalStore: the server (and the hydrating client render)
 * see `DEFAULT_PREFERENCES`, then React reconciles to the stored values after
 * hydration with no mismatch. Theme itself never flashes because the inline
 * no-flash script in `layout.tsx` sets the `dark` class before first paint.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Keep <html> in sync with the resolved theme + active language.
  useEffect(() => {
    applyTheme(prefs.theme);
    document.documentElement.lang = prefs.locale;
  }, [prefs.theme, prefs.locale]);

  // Mirror the sound preference into the (module-level) sound engine.
  useEffect(() => {
    setSoundEnabled(prefs.sound);
  }, [prefs.sound]);

  // Live-follow the OS when the theme is "system".
  useEffect(() => {
    if (prefs.theme !== "system" || typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [prefs.theme]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      ...prefs,
      setTheme: (theme) => setSnapshot({ ...getSnapshot(), theme }),
      setLocale: (locale) => setSnapshot({ ...getSnapshot(), locale }),
      setMapType: (mapType) => setSnapshot({ ...getSnapshot(), mapType }),
      setSound: (sound) => setSnapshot({ ...getSnapshot(), sound }),
    }),
    [prefs],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

/**
 * Access preferences + setters. Falls back to defaults (no-op setters) when no
 * provider is mounted, so components stay renderable in isolation / tests.
 */
export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    return {
      ...DEFAULT_PREFERENCES,
      setTheme: () => {},
      setLocale: () => {},
      setMapType: () => {},
      setSound: () => {},
    };
  }
  return ctx;
}
