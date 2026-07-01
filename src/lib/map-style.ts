import type { StyleSpecification } from "maplibre-gl";

/** Free, key-less dark basemap (CARTO raster over OSM data). Shared by all maps. */
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
      attribution: "© OpenStreetMap © CARTO",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#0b0b0c" } },
    { id: "carto", type: "raster", source: "carto", paint: { "raster-opacity": 0.92 } },
  ],
};
