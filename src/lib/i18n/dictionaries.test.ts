import { describe, expect, it } from "vitest";
import { en } from "./en";
import { sv } from "./sv";
import { pl } from "./pl";
import { uk } from "./uk";
import { lt } from "./lt";

const enKeys = Object.keys(en).sort();
const locales = { sv, pl, uk, lt } as const;

describe("locale dictionaries", () => {
  for (const [name, dict] of Object.entries(locales)) {
    const keys = Object.keys(dict);

    it(`${name} has no keys that are missing from English`, () => {
      const extra = keys.filter((k) => !(k in en));
      expect(extra).toEqual([]);
    });

    it(`${name} covers every English key`, () => {
      const missing = enKeys.filter((k) => !(k in dict));
      expect(missing).toEqual([]);
    });

    it(`${name} has no empty translations`, () => {
      const empty = keys.filter((k) => !(dict as Record<string, string>)[k]?.trim());
      expect(empty).toEqual([]);
    });
  }
});
