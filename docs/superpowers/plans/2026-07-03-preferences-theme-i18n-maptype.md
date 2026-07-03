# Preferences (Theme · Language · Map Type) Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans (inline, batched with checkpoints). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add device-local preferences — light/system theme + theme selector, a 5-language selector (EN/SV/PL/UK/LT), and a MapLibre map-type selector (normal/satellite/terrain/hybrid) — surfaced from one Settings menu.

**Architecture:** A single `PreferencesProvider` (React context, `localStorage` `atlas:prefs:v1`) mounted in `AppProviders`, with an inline no-flash script in the root layout. Theme flips a `.dark` class on `<html>`; i18n is a dependency-free typed dictionary + `useT()` hook (no routing change); map type drives `map.setStyle()` on all four MapLibre instances.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4 (CSS-first), MapLibre GL, Radix dropdown, `motion`, Convex/Clerk (untouched).

## Global Constraints

- Default theme `system`; default locale `en`; default map type `normal`.
- No new npm dependencies (use Radix dropdown + existing primitives).
- No Convex schema change; no locale routing; canonical URLs + server `metadata` stay English.
- Light palette must pass the project contrast rules (no white-on-white, visible hovers/focus/labels).
- Missing translation key → English fallback, never a raw key.
- Only touch files owned by this feature; do NOT touch pre-existing modified files (`convex/chat.ts`, `convex/gameLogic.ts`, `new-todos.md`).
- Commit each phase; end commit messages with the Co-Authored-By trailer.

---

### Task 1: Preferences foundation (lib + provider + hooks)

**Files:**
- Create: `src/lib/preferences.ts` — types, defaults, load/save.
- Create: `src/components/preferences/preferences-provider.tsx` — context + effects.
- Create: `src/hooks/use-preferences.ts` — re-export `usePreferences`.
- Test: `src/lib/preferences.test.ts`.

**Interfaces — Produces:**
- `type Theme = "system" | "light" | "dark"`
- `type Locale = "en" | "sv" | "pl" | "uk" | "lt"`
- `type MapType = "normal" | "satellite" | "terrain" | "hybrid"`
- `interface Preferences { theme: Theme; locale: Locale; mapType: MapType }`
- `DEFAULT_PREFERENCES`, `loadPreferences(): Preferences`, `savePreferences(p): void`
- `usePreferences(): Preferences & { setTheme; setLocale; setMapType }`

- [ ] Write `preferences.test.ts`: `loadPreferences` returns defaults when storage empty/corrupt; `save`→`load` round-trips; unknown keys merge to defaults.
- [ ] Implement `src/lib/preferences.ts` mirroring `local-profile.ts` (SSR guard, try/catch, defaults merge, validate enum membership).
- [ ] Implement provider: state seeded from `loadPreferences()`; setters persist; effect toggles `.dark` on `document.documentElement` + sets `style.colorScheme`; `system` subscribes to `matchMedia('(prefers-color-scheme: dark)')`; effect sets `documentElement.lang`.
- [ ] Run `npx vitest run src/lib/preferences.test.ts` → PASS.
- [ ] Commit.

### Task 2: No-flash script + mount provider + themeColor

**Files:**
- Modify: `src/app/layout.tsx` (inline pre-paint script in body start; theme-aware `viewport.themeColor`).
- Modify: `src/components/providers.tsx` (wrap `inner` in `PreferencesProvider`).

- [ ] Add an IIFE `<script dangerouslySetInnerHTML>` at the top of `<body>` that reads `atlas:prefs:v1`, resolves `system` via `matchMedia`, and adds/removes `dark` + sets `colorScheme` before paint. Guard in try/catch.
- [ ] `viewport.themeColor` → `[{ media: "(prefers-color-scheme: light)", color: "#f7f7f8" }, { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" }]`.
- [ ] Mount `PreferencesProvider` as the outermost UI provider in all three `AppProviders` branches.
- [ ] Manual: reload → no theme flash. Commit.

### Task 3: Theme — light + dark palettes and overlay tokens

**Files:**
- Modify: `src/app/globals.css` (palette split + `--overlay*` + light `--glass*`).
- Modify shared UI overlays where they break in light: `src/components/ui/button.tsx`, `segmented.tsx`, `card.tsx`, and any load-bearing `bg-white/[x]`/`border-white/[x]` in header/game HUD.

- [ ] Move the current dark values from `:root` into `.dark { … }`. Author a **light** `:root` palette (near-white `--background #f7f7f8`, `--card #ffffff`, dark foregrounds, same Apple-blue `--primary`, hairline borders as black-alpha, readable `--muted-foreground`/`--subtle`).
- [ ] Add `--overlay`, `--overlay-hover`, `--overlay-strong` (white-alpha in `.dark`, black-alpha in `:root`) and light-theme `--glass`/`--glass-strong`. Expose overlay tokens in `@theme inline`.
- [ ] Replace load-bearing `bg-white/[0.06]`, `bg-white/5`, `bg-white/10`, `border-white/…` in shared UI + HUD with overlay tokens or `dark:` variants so contrast holds in light. Remove the static `color-scheme: dark` from `html` (provider owns it).
- [ ] Manual: home, play setup, in-game HUD, round reveal, profile, leaderboard in Light + Dark + System — contrast pass. Commit.

### Task 4: Map types

**Files:**
- Modify: `src/lib/map-style.ts` (add `MAP_STYLES` + `mapStyleFor(type)`).
- Modify: `src/components/game/guess-map.tsx`, `match-map.tsx`, `src/components/multiplayer/reveal-map.tsx`, `src/components/maps/map-creator.tsx`.
- Test: `src/lib/map-style.test.ts`.

**Interfaces — Produces:** `MAP_STYLES: Record<MapType, StyleSpecification>`, `mapStyleFor(t: MapType): StyleSpecification`.

- [ ] Add styles: normal=CARTO Voyager (existing); satellite=Esri World Imagery (`.../World_Imagery/MapServer/tile/{z}/{y}/{x}`); terrain=OpenTopoMap (`{a,b,c}.tile.opentopomap.org/{z}/{x}/{y}.png`); hybrid=Esri Imagery + Esri reference overlays. Keep `CARTO_DARK_STYLE` alias.
- [ ] Test `mapStyleFor` returns a valid v8 style for each type and defaults to normal on bad input.
- [ ] In each map component: read `mapType` from `usePreferences()`, init with `mapStyleFor(mapType)`. On `mapType` change call `map.setStyle(...)` and re-add custom sources/layers + markers on the `styledata`/`load` handler (guard with a ref so mid-game markers survive).
- [ ] `npx vitest run src/lib/map-style.test.ts` → PASS. Manual: switch types on guess map, markers/hint/result line survive. Commit.

### Task 5: i18n infrastructure + English dictionary

**Files:**
- Create: `src/lib/i18n/index.ts`, `src/lib/i18n/en.ts`.
- Create: `src/hooks/use-t.ts`.
- Test: `src/lib/i18n/i18n.test.ts`.

**Interfaces — Produces:**
- `translate(locale, key, params?): string` (English fallback + `{param}` interpolation).
- `useT(): (key: TKey, params?) => string`.
- `type TKey = keyof typeof en`.
- `LOCALES: { code: Locale; native: string }[]`.

- [ ] Write `en.ts` as the source of truth — flat `as const` object of every UI string keyed by dotted namespace (`nav.play`, `settings.theme`, `play.chooseMap`, `home.hero.title`, `home.faq.*`, …). Grow it as strings are extracted in Task 7.
- [ ] Implement `translate` (fallback to `en`, then to the key; `{name}` interpolation) and `useT` (reads locale from `usePreferences`).
- [ ] Test: interpolation; fallback to en for missing key; returns key only if en also missing.
- [ ] `npx vitest run src/lib/i18n/i18n.test.ts` → PASS. Commit.

### Task 6: Settings menu

**Files:**
- Create: `src/components/preferences/settings-menu.tsx`.
- Modify: `src/components/site-header.tsx` (add gear button).

- [ ] Radix `DropdownMenu` triggered by a gear `Button variant="ghost" size="icon-sm"`. Three labeled `Segmented` groups: theme (System/Light/Dark), language (native names), map type. Wire to `usePreferences()` setters. Localize labels via `useT()`.
- [ ] Add to `SiteHeader` before/after `AuthSlot`. Contrast-check the menu in both themes.
- [ ] Manual: each control persists across reload and reflects immediately. Commit.

### Task 7: String extraction + translation sweep (all components incl. homepage)

**Files:** every user-facing `*.tsx` under `src/` + `src/lib/i18n/{sv,pl,uk,lt}.ts`.

- [ ] Extract every hardcoded user-facing string into `en.ts` keys and replace with `t("…")`. Cover: header/nav, home (hero, highlights, how-to-play, "What is Atlas", FAQ), play setup, game HUD, round reveal, results, maps, leaderboard, profile, friends, multiplayer/room, auth, toasts, empty/error states, achievement labels. Work area-by-area, committing per area.
- [ ] Create `sv.ts`, `pl.ts`, `uk.ts`, `lt.ts` typed as `Record<TKey, string>` (so a missing key fails `tsc`) with accurate native translations. Dispatch translations per language as isolated subagents once `en.ts` is frozen.
- [ ] Add `i18n.dictionaries.test.ts`: each non-en dictionary has exactly the `en` key set (no missing/extra).
- [ ] Run full suite + `tsc` + lint; fix. Commit per area.

### Task 8: Verify + review

- [ ] `npx tsc --noEmit` (or `npm run build`), `npm run lint`, `npx vitest run` — all green.
- [ ] Browser pass: 3 themes × key pages (contrast), 4 map types on guess map, 5 languages (no raw keys, layout holds for long strings).
- [ ] Independent review (`/caveman-review` or local reviewer) on the diff; fix blocking issues. Commit. Update docs (`AGENTS.md`/README notes on preferences).

## Status (2026-07-03)

All four features implemented and verified (`tsc` clean, `next build` green — 15
routes, 94 tests pass). Committed in isolated commits:
- `feat(theme)` — light/dark palettes, theme tokens, `PreferencesProvider`.
- `feat(maps)` — 4 basemaps wired into all maps.
- `feat(i18n)` — selector + settings menu; core screens translated into 5 languages.

**Deferred / not committed by this task (a concurrent agent is actively building
survival mode, a daily challenge, presence/live-stats and team multiplayer,
rewriting ~20 files):**
- `src/app/layout.tsx` (no-flash script + `themeColor`) and
  `src/components/providers.tsx` (provider mount) carry this task's wiring **plus**
  the other agent's preconnect/presence edits. They are functional in the working
  tree (build passes) but left uncommitted because committing them would drag in
  the other agent's still-untracked `presence-ping.tsx` and break the committed
  tree. Commit these two together when the presence work lands.
- Multiplayer `room-game.tsx` / `room-results.tsx` / `scoreboard.tsx` — their i18n
  edits are in the working tree but not staged (files also contain the in-flight
  team-mode code).
- Full-string translation of the marketing homepage and the hot gameplay files
  (play setup/flow, in-game HUD, round reveal, results, daily, room lobby) is
  deferred to avoid clobbering the concurrent feature work. These surfaces fall
  back to English via the i18n fallback, so nothing is broken — run the extraction
  sweep on them once that work settles. Three profile sub-components
  (`recent-games`, `stats-grid`, `achievement-grid`) are Server Components; add
  `"use client"` before localizing them.

## Self-Review notes

- Spec coverage: Task 1–2 (provider/no-flash), Task 3 (light theme + HUD), Task 4 (all maps), Task 5–7 (i18n incl. homepage), Task 6 (selectors). All spec sections mapped.
- Type consistency: `MapType`/`Theme`/`Locale` defined once in `preferences.ts`, imported by i18n/map-style; `mapStyleFor` name used consistently; `TKey = keyof typeof en` used in dictionaries + `translate`.
