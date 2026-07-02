import type { StyleSpecification } from "maplibre-gl";

/** Free, key-less light basemap (CARTO Voyager over OSM). Shared by all maps. */
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
      attribution: "© OpenStreetMap © CARTO",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#aadaff" } },
    { id: "carto", type: "raster", source: "carto", paint: { "raster-opacity": 1 } },
  ],
};

/** Back-compat alias — call sites import CARTO_DARK_STYLE. */
export const CARTO_DARK_STYLE = CARTO_LIGHT_STYLE;
