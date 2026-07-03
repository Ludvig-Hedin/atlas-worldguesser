"use client";

import { useCallback } from "react";
import { usePreferences } from "@/hooks/use-preferences";
import { translate, type TKey, type TParams } from "@/lib/i18n";

/**
 * Returns a `t(key, params?)` translator bound to the active locale. The
 * function identity is stable per-locale so it can sit safely in effect deps.
 */
export function useT() {
  const { locale } = usePreferences();
  return useCallback(
    (key: TKey, params?: TParams) => translate(locale, key, params),
    [locale],
  );
}
