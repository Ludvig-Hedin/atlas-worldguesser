import { describe, expect, it } from "vitest";
import { LOCALES, translate } from "./index";
import { en } from "./en";

describe("translate", () => {
  it("returns the localized string when present", () => {
    expect(translate("sv", "nav.play")).toBe("Spela");
    expect(translate("pl", "settings.theme")).toBe("Motyw");
  });

  it("falls back to English for a locale missing the key", () => {
    // A key not yet translated in a locale resolves to English, never a raw key.
    const value = translate("lt", "common.loading");
    expect(typeof value).toBe("string");
    expect(value).not.toBe("common.loading");
  });

  it("interpolates {name} placeholders", () => {
    expect(translate("en", "round.counter", { current: 2, total: 5 })).toBe("Round 2 of 5");
    // A locale without the key still interpolates via the English fallback.
    expect(translate("sv", "round.counter", { current: 1, total: 3 })).toBe("Round 1 of 3");
  });

  it("every locale exposes its endonym", () => {
    expect(LOCALES.map((l) => l.code)).toEqual(["en", "sv", "pl", "uk", "lt"]);
    for (const l of LOCALES) expect(l.native.length).toBeGreaterThan(0);
  });

  it("en is the source of truth and has the seeded keys", () => {
    expect(en["settings.title"]).toBe("Settings");
    expect(en["settings.mapType.hybrid"]).toBe("Hybrid");
  });
});
