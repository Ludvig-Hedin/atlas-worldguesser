import { describe, expect, it } from "vitest";
import { LOCALES, translate, type TKey } from "./index";
import { en } from "./en";

describe("translate", () => {
  it("returns the localized string when present", () => {
    expect(translate("sv", "nav.play")).toBe("Spela");
    expect(translate("pl", "settings.theme")).toBe("Motyw");
  });

  it("falls back to English then to the key for an unknown key", () => {
    // Cast an unknown key: no locale (incl. en) has it, so we get the key back.
    const unknown = "__does.not.exist__" as TKey;
    expect(translate("lt", unknown)).toBe("__does.not.exist__");
    expect(translate("en", unknown)).toBe("__does.not.exist__");
  });

  it("interpolates {name} placeholders in en and in a translated locale", () => {
    expect(translate("en", "round.counter", { current: 2, total: 5 })).toBe("Round 2 of 5");
    expect(translate("sv", "round.counter", { current: 1, total: 3 })).toBe("Runda 1 av 3");
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
