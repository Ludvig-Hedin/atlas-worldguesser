import { describe, expect, it } from "vitest";
import { countryAtAsync } from "./geo";

describe("countryAtAsync", () => {
  it("locates a point in Sweden", async () => {
    expect(await countryAtAsync({ lat: 59.33, lng: 18.06 })).toBe("SE");
  });

  it("locates a point in the United States", async () => {
    expect(await countryAtAsync({ lat: 40.71, lng: -74.0 })).toBe("US");
  });

  it("locates a point in Japan", async () => {
    expect(await countryAtAsync({ lat: 35.68, lng: 139.75 })).toBe("JP");
  });

  it("returns null for open ocean", async () => {
    expect(await countryAtAsync({ lat: 0, lng: -30 })).toBeNull();
  });
});
