import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { MapType } from "@/lib/preferences";

/**
 * Basemap styles for the MapLibre maps. All sources are free and key-less, in
 * keeping with the rest of the app (no Google/Mapbox token required).
 *
 * - normal    → CARTO Voyager (labelled street map over OSM)
 * - satellite → Esri World Imagery
 * - terrain   → OpenTopoMap (contours + hillshade)
 * - hybrid    → Esri World Imagery + Esri reference (boundaries + place labels)
 */

const CARTO_ATTRIB = "© OpenStreetMap © CARTO";
const ESRI_ATTRIB = "Imagery © Esri, Maxar, Earthstar Geographics";
const TOPO_ATTRIB = "© OpenStreetMap, SRTM · © OpenTopoMap (CC-BY-SA)";

const ESRI_IMAGERY_TILES = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
];
const ESRI_REFERENCE_TILES = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
];

/** Free, key-less labelled basemap (CARTO Voyager over OSM). The default. */
export const CARTO_LIGHT_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: CARTO_ATTRIB,
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#aadaff" } },
    { id: "carto", type: "raster", source: "carto", paint: { "raster-opacity": 1 } },
  ],
};

/** Free, key-less dark basemap (CARTO Dark Matter over OSM). Used for the
 * "normal" map style when the dark-map preference is on. */
export const CARTO_DARK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: CARTO_ATTRIB,
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#0b0f14" } },
    { id: "carto", type: "raster", source: "carto", paint: { "raster-opacity": 1 } },
  ],
};

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    esriImagery: {
      type: "raster",
      tiles: ESRI_IMAGERY_TILES,
      tileSize: 256,
      maxzoom: 19,
      attribution: ESRI_ATTRIB,
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#0b1a2b" } },
    { id: "esriImagery", type: "raster", source: "esriImagery" },
  ],
};

const TERRAIN_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    opentopo: {
      type: "raster",
      tiles: [
        "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
        "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
        "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 17,
      attribution: TOPO_ATTRIB,
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#cfe6cf" } },
    { id: "opentopo", type: "raster", source: "opentopo" },
  ],
};

const HYBRID_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    esriImagery: {
      type: "raster",
      tiles: ESRI_IMAGERY_TILES,
      tileSize: 256,
      maxzoom: 19,
      attribution: ESRI_ATTRIB,
    },
    esriReference: {
      type: "raster",
      tiles: ESRI_REFERENCE_TILES,
      tileSize: 256,
      maxzoom: 19,
      attribution: ESRI_ATTRIB,
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#0b1a2b" } },
    { id: "esriImagery", type: "raster", source: "esriImagery" },
    { id: "esriReference", type: "raster", source: "esriReference" },
  ],
};

export const MAP_STYLES: Record<MapType, StyleSpecification> = {
  normal: CARTO_LIGHT_STYLE,
  satellite: SATELLITE_STYLE,
  terrain: TERRAIN_STYLE,
  hybrid: HYBRID_STYLE,
};

/**
 * Resolve a map-type preference to its style, defaulting to the normal basemap.
 * `dark` swaps the "normal" style to dark tiles (satellite/terrain/hybrid have
 * no free key-less dark variant, so they're unaffected).
 */
export function mapStyleFor(type: MapType, dark = false): StyleSpecification {
  if (type === "normal" && dark) return CARTO_DARK_STYLE;
  return MAP_STYLES[type] ?? CARTO_LIGHT_STYLE;
}

/* --------------------------------------------------------------------------
 * Flags mode — a blank, label-free country map (Seterra style).
 *
 * No basemap tiles (works fully offline) and no place labels (they'd give the
 * answer away). Countries come from an in-memory GeoJSON source so clicks and
 * hover/answer coloring are driven by `feature-state`.
 * ------------------------------------------------------------------------ */

/** Per-attempt answer colors, shared with the reveal banner. Theme-independent. */
export const FLAG_STATUS_COLORS = {
  correct: "#22c55e",
  wrong1: "#f59e0b", // amber
  wrong2: "#f97316", // orange
  wrong3: "#ef4444", // red
} as const;

interface CountryPaint {
  ocean: string;
  land: string;
  hoverLand: string;
  border: string;
  /** Data-driven fill color keyed off the `status`/`hover` feature-state. */
  fillColor: ExpressionSpecification;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Blend a status color toward the base land color — used for the muted
 *  "past round" trail so it reads as history, not an active answer. */
function muted(hex: string, land: string): string {
  const [r1, g1, b1] = hexToRgb(hex);
  const [r2, g2, b2] = hexToRgb(land);
  const t = 0.45; // weight toward the status color
  const mix = (a: number, b: number) => Math.round(a * t + b * (1 - t));
  return `#${[mix(r1, r2), mix(g1, g2), mix(b1, b2)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Land/ocean/border colors + the fill expression for the current theme. */
export function countryPaint(dark: boolean): CountryPaint {
  const ocean = dark ? "#0e1622" : "#cfe0ee";
  const land = dark ? "#232a35" : "#f1efe8";
  const hoverLand = dark ? "#2e3a49" : "#dbe7f4";
  const border = dark ? "#3a434f" : "#b7c0ca";
  const c = FLAG_STATUS_COLORS;
  const m = {
    correct: muted(c.correct, land),
    wrong1: muted(c.wrong1, land),
    wrong2: muted(c.wrong2, land),
    wrong3: muted(c.wrong3, land),
  };
  const fillColor: ExpressionSpecification = [
    "match",
    ["feature-state", "status"],
    "correct", c.correct,
    "revealed", c.correct,
    "wrong1", c.wrong1,
    "wrong2", c.wrong2,
    "wrong3", c.wrong3,
    // No active status this round — fall back to the muted history trail
    // from past rounds, then hover highlight, then base land.
    [
      "match",
      ["feature-state", "pastStatus"],
      "correct", m.correct,
      "revealed", m.correct,
      "wrong1", m.wrong1,
      "wrong2", m.wrong2,
      "wrong3", m.wrong3,
      ["case", ["boolean", ["feature-state", "hover"], false], hoverLand, land],
    ],
  ];
  return { ocean, land, hoverLand, border, fillColor };
}

/** Build the blank country style for a theme from an already-loaded FeatureCollection. */
export function blankCountryStyle(dark: boolean, fc: FeatureCollection): StyleSpecification {
  const p = countryPaint(dark);
  return {
    version: 8,
    // Empty glyph URL keeps the style valid without a font server (no labels).
    sources: {
      countries: { type: "geojson", data: fc, promoteId: "iso" },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": p.ocean } },
      {
        id: "country-fill",
        type: "fill",
        source: "countries",
        // Ease the wrong/correct color swap instead of an instant hard-cut.
        paint: { "fill-color": p.fillColor, "fill-color-transition": { duration: 260 } },
      },
      {
        id: "country-border",
        type: "line",
        source: "countries",
        paint: { "line-color": p.border, "line-width": 0.7 },
      },
    ],
  };
}
