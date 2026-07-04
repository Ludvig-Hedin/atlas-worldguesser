import { describe, expect, it } from "vitest";
import { MAP_STYLES, mapStyleFor, CARTO_LIGHT_STYLE, CARTO_DARK_STYLE } from "./map-style";
import type { MapType } from "./preferences";

const ALL: MapType[] = ["normal", "satellite", "terrain", "hybrid"];

describe("mapStyleFor", () => {
  it("returns a valid v8 style with at least one source for every map type", () => {
    for (const type of ALL) {
      const style = mapStyleFor(type);
      expect(style.version).toBe(8);
      expect(Object.keys(style.sources).length).toBeGreaterThan(0);
      expect(style.layers.length).toBeGreaterThan(0);
    }
  });

  it("maps normal to the CARTO basemap", () => {
    expect(mapStyleFor("normal")).toBe(CARTO_LIGHT_STYLE);
  });

  it("hybrid overlays a reference layer on top of imagery", () => {
    const hybrid = MAP_STYLES.hybrid;
    expect(Object.keys(hybrid.sources)).toContain("esriImagery");
    expect(Object.keys(hybrid.sources)).toContain("esriReference");
  });

  it("falls back to the normal basemap for an unknown type", () => {
    // @ts-expect-error — exercising the runtime guard with a bad value.
    expect(mapStyleFor("hologram")).toBe(CARTO_LIGHT_STYLE);
  });

  it("swaps to dark tiles for normal when dark is true", () => {
    expect(mapStyleFor("normal", true)).toBe(CARTO_DARK_STYLE);
    expect(mapStyleFor("normal", false)).toBe(CARTO_LIGHT_STYLE);
  });

  it("leaves non-normal styles unaffected by the dark flag", () => {
    for (const type of ALL.filter((t) => t !== "normal")) {
      expect(mapStyleFor(type, true)).toBe(MAP_STYLES[type]);
    }
  });

  it("CARTO_DARK_STYLE is a distinct, valid v8 style", () => {
    expect(CARTO_DARK_STYLE).not.toBe(CARTO_LIGHT_STYLE);
    expect(CARTO_DARK_STYLE.version).toBe(8);
    expect(Object.keys(CARTO_DARK_STYLE.sources).length).toBeGreaterThan(0);
  });
});
