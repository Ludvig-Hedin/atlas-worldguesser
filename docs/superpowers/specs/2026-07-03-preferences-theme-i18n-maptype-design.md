# Design: Preferences — Light/System Theme, Language, Map Type

Date: 2026-07-03
Status: Approved (design direction confirmed by product owner)

## Goal

Add three user-facing preferences to Atlas, surfaced from a single Settings menu:

1. **Theme** — light mode that adapts to the OS, plus a theme selector (`System` /
   `Light` / `Dark`), default `System`. Today the app is dark-only.
2. **Language** — selector for English, Swedish, Polish, Ukrainian, Lithuanian.
3. **Map type** — `Normal` / `Satellite` / `Terrain` / `Hybrid` for the MapLibre maps.

### Scope decisions (confirmed)

- **i18n:** translate the **entire app including the marketing/FAQ homepage** into all
  five languages.
- **Theme:** light mode applies everywhere **including the in-game HUD** (glass overlays,
  compass, minimap frame) — not just app chrome.
- **Map type:** applies to **all four MapLibre map instances** (guess, match, reveal,
  creator).

## Architecture

One shared client-side preferences layer. All three settings are device-local UI
preferences — no Convex schema change (keeps the backend simple).

### `PreferencesProvider` (`src/components/preferences/`)

- React context holding `{ theme, locale, mapType }`.
- Persisted to `localStorage` under `atlas:prefs:v1`, mirroring the existing
  `local-profile` / `last-game` pattern (safe JSON parse, SSR guard, defaults merge).
- Mounted inside `AppProviders` (outermost UI provider, above `TooltipProvider`).
- Exposes `usePreferences()` returning the values plus setters.
- Applies the theme by toggling a `dark` class on `<html>` and setting
  `document.documentElement.style.colorScheme`. `system` subscribes to
  `matchMedia('(prefers-color-scheme: dark)')` and updates live.
- Updates `<html lang>` to the active locale.

### No-flash script

An inline `<script>` in `app/layout.tsx` `<head>` reads `atlas:prefs:v1` (or the OS
preference for `system`) and sets the `dark` class + `color-scheme` **before first
paint**, so there is no light/dark flash on load. `<html suppressHydrationWarning>` is
already present.

### Settings menu

A gear-icon button in `SiteHeader` opens a Radix dropdown (`@radix-ui/react-dropdown-menu`,
already a dependency) containing three grouped `Segmented` controls:
- Theme: System / Light / Dark
- Language: EN / SV / PL / UK / LT (native names)
- Map type: Normal / Satellite / Terrain / Hybrid

The menu itself is localized. The header (and thus Settings) renders on every chrome page;
the in-game screens get the same control where a header exists, otherwise the preference is
still honored because it is global.

## Feature 1 — Theme

`globals.css` today bakes the dark palette into `:root`. Rework:

- `:root` becomes the **light** palette; `.dark` (class on `<html>`) holds the **dark**
  palette (the current values move here verbatim).
- Introduce theme-aware overlay tokens so the ~63 hardcoded `white/[x]` and `black/[x]`
  utility overlays read correctly in both themes:
  - `--overlay`, `--overlay-strong`, `--overlay-hover` (white-alpha in dark, black-alpha in
    light). Replace the most load-bearing `bg-white/[0.06]`, `bg-white/5`, `bg-white/10`
    usages (buttons, `Segmented`, ghost hovers, cards) with these tokens or `dark:`
    variants.
- `--glass` / `--glass-strong` get light-theme values so the in-game HUD flips to light.
- `html { color-scheme }` becomes dynamic (set by provider / no-flash script).
- `layout.tsx` `viewport.themeColor` becomes theme-aware (array form with `media`).
- Light palette must satisfy the project contrast rules: no white-on-white, readable
  labels/icons on cards, visible hovers, visible focus rings.

## Feature 2 — i18n

Lightweight, dependency-free, **no routing change** (preserves the tuned SEO + Clerk/Convex
wiring; URLs stay canonical English while UI text localizes).

- `src/lib/i18n/index.ts` — `Locale` type, `LOCALES` metadata (code, native label),
  `dictionaries` map, `translate(locale, key, params)` with English fallback + `{param}`
  interpolation.
- `src/lib/i18n/{en,sv,pl,uk,lt}.ts` — typed dictionaries. `en` is the source of truth;
  the others must have identical key sets (typed as `Record<keyof typeof en, string>` so a
  missing key fails typecheck).
- `useT()` hook reads the active locale from `usePreferences()` and returns `t(key, params)`.
- Extract every user-facing string across the 73 components — including the homepage hero,
  “How to play”, “What is Atlas”, and FAQ — into keys, then translate.
- Keep `metadata`/SEO copy and `<html lang>` default as English (server-rendered); the
  client updates `lang` on locale change.

## Feature 3 — Theme selector

Part of the Settings menu (see Architecture). Values `system | light | dark`, default
`system`. Covered by Feature 1's provider.

## Feature 4 — Map type

Extend `src/lib/map-style.ts` with a `MAP_STYLES: Record<MapType, StyleSpecification>` using
free, key-less raster sources (consistent with the current key-less approach):

- **Normal** — CARTO Voyager (current style).
- **Satellite** — Esri World Imagery
  (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`).
- **Terrain** — OpenTopoMap (`https://{a,b,c}.tile.opentopomap.org/{z}/{x}/{y}.png`).
- **Hybrid** — Esri World Imagery + Esri reference overlays (Boundaries/Places +
  Transportation) as a second raster layer for labels.

Each map instance (`guess-map`, `match-map`, `reveal-map`, `map-creator`) reads `mapType`
from `usePreferences()`, initializes with the matching style, and calls `map.setStyle(...)`
when it changes — re-adding the custom sources/layers (result line, hint circle, markers)
on `styledata`, since `setStyle` clears them.

## Components / files

New:
- `src/components/preferences/preferences-provider.tsx`
- `src/components/preferences/settings-menu.tsx`
- `src/lib/preferences.ts` (types, load/save, defaults)
- `src/lib/i18n/index.ts`, `src/lib/i18n/en.ts`, `sv.ts`, `pl.ts`, `uk.ts`, `lt.ts`
- `src/hooks/use-preferences.ts` (or export from provider), `src/hooks/use-t.ts`

Changed (high-level):
- `src/app/globals.css` (light + dark palettes, overlay tokens)
- `src/app/layout.tsx` (no-flash script, themeColor)
- `src/components/providers.tsx` (mount provider)
- `src/components/site-header.tsx` (Settings menu)
- `src/lib/map-style.ts` (+ map consumers)
- ~73 tsx components (string extraction)
- Overlay-token swaps in shared UI (`button`, `segmented`, `card`, etc.)

## Error handling / edge cases

- localStorage unavailable / corrupt → fall back to defaults (`system`, `en`, `normal`).
- SSR: provider renders children immediately; theme class applied by no-flash script so no
  hydration mismatch (`suppressHydrationWarning` already set).
- Missing translation key → English fallback (never render a raw key).
- `setStyle` race: guard re-adding layers behind `styledata` + a “loaded” ref so markers/
  hint/result layers survive a map-type switch mid-game.
- Reduced-motion already handled globally; segmented indicator respects it.

## Testing

- Unit: `preferences` load/save/merge + defaults; `translate` fallback + interpolation;
  every non-en dictionary has the exact `en` key set (typecheck already enforces, add a
  runtime test as a guard).
- Manual/browser: toggle each theme on home + in-game (contrast check), switch each map type
  on the guess map (verify markers/hint/result survive), switch each language and confirm
  no raw keys and layout holds for longer strings.
- `npm run lint`, `npx tsc --noEmit` (or `npm run build`), `npx vitest run`.

## Non-goals

- Server-side/locale-routed pages, per-locale canonical URLs, translated `<title>`/meta.
- Syncing preferences to Convex across devices (device-local only for now).
