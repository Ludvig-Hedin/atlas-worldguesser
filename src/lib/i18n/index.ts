import type { Locale } from "@/lib/preferences";
import { en, type TKey, type LocaleDictionary } from "./en";
import { sv } from "./sv";
import { pl } from "./pl";
import { uk } from "./uk";
import { lt } from "./lt";

export type { TKey } from "./en";

export const dictionaries: Record<Locale, LocaleDictionary> = { en, sv, pl, uk, lt };

export interface LocaleMeta {
  code: Locale;
  /** Endonym — how speakers write the language's own name. */
  native: string;
  /** English name, for tooltips / accessibility. */
  english: string;
}

/** Ordered list powering the language selector. */
export const LOCALES: LocaleMeta[] = [
  { code: "en", native: "English", english: "English" },
  { code: "sv", native: "Svenska", english: "Swedish" },
  { code: "pl", native: "Polski", english: "Polish" },
  { code: "uk", native: "Українська", english: "Ukrainian" },
  { code: "lt", native: "Lietuvių", english: "Lithuanian" },
];

export type TParams = Record<string, string | number>;

/**
 * Resolve a key for a locale, falling back to English then to the key itself,
 * and interpolating `{name}` placeholders. Never returns a bare key when English
 * has the string.
 */
export function translate(locale: Locale, key: TKey, params?: TParams): string {
  const dict = dictionaries[locale] ?? en;
  let str: string = dict[key] ?? en[key] ?? String(key);
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      str = str.split(`{${name}}`).join(String(value));
    }
  }
  return str;
}
