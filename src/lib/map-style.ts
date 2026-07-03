import type { StyleSpecification } from "maplibre-gl";
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

/** Back-compat alias — several call sites import CARTO_DARK_STYLE. */
export const CARTO_DARK_STYLE = CARTO_LIGHT_STYLE;

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

/** Resolve a map-type preference to its style, defaulting to the normal basemap. */
export function mapStyleFor(type: MapType): StyleSpecification {
  return MAP_STYLES[type] ?? CARTO_LIGHT_STYLE;
}
