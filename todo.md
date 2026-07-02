To do:

Done (2026-07-02):

- [x] Some clickable actions don't have pointer cursor → global `cursor:pointer` for buttons/links/labels (Tailwind v4 preflight had dropped it).
- [x] 3% chance of swapping in Åkers Styckebruk, Sweden → deterministic easter-egg in solo + multiplayer location picking.
- [x] You don't see road/street names → Street View `showRoadLabels` enabled.
- [x] Can't see locations on the map (Eiffel Tower etc.) → light Voyager basemap shows POIs; guess-map max zoom raised to 18.
- [x] Semi-transparent compass at the top (Fortnite-style) → new `CompassStrip` (bearing + cardinal/degree ticks) driven by the Street View heading; shown in demo too.
- [x] Hover on the minimap not smooth → refined the expand transition (springy easing, will-change).

Partially addressed (Google coverage limits — cannot fully guarantee):

- [~] Sometimes spawn where you cannot move → widened the panorama search radius (50 km) so more spots resolve to road-connected coverage. Single-shot panoramas with no links still exist in Google's data.
- [~] Sometimes spawn with no Street View (only the demo graphic) → same wider radius reduces this; countries with zero Google coverage still fall back to the demo view (now labelled "No Street View here").
