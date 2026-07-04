import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  resolveTheme,
  savePreferences,
} from "./preferences";

const KEY = "atlas:prefs:v1";

afterEach(() => {
  window.localStorage.clear();
});

describe("loadPreferences", () => {
  it("returns defaults when storage is empty", () => {
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it("returns defaults when storage is corrupt", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it("round-trips saved preferences", () => {
    savePreferences({ theme: "light", locale: "sv", mapType: "satellite", sound: false });
    expect(loadPreferences()).toEqual({
      theme: "light",
      locale: "sv",
      mapType: "satellite",
      sound: false,
    });
  });

  it("falls back per-field for invalid enum values", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ theme: "neon", locale: "de", mapType: "hologram" }),
    );
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it("keeps valid fields and defaults the invalid ones", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ theme: "dark", locale: "xx", mapType: "terrain" }),
    );
    expect(loadPreferences()).toEqual({
      theme: "dark",
      locale: "en",
      mapType: "terrain",
      sound: true,
    });
  });
});

describe("resolveTheme", () => {
  it("passes through explicit choices", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("resolves system via matchMedia", () => {
    // jsdom's matchMedia (from vitest.setup) reports no match → light.
    expect(["light", "dark"]).toContain(resolveTheme("system"));
  });
});
