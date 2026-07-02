import { describe, expect, it } from "vitest";
import { findPanorama } from "./google-maps";

// Minimal stub of the google.maps enums referenced during a lookup.
(globalThis as unknown as { google: unknown }).google = {
  maps: {
    StreetViewPreference: { NEAREST: "nearest" },
    StreetViewSource: { OUTDOOR: "outdoor" },
    StreetViewStatus: { OK: "OK" },
  },
};

type FakeSvc = { getPanorama: (req: { location: { lat: number } }, cb: (d: unknown, s: string) => void) => void };

describe("findPanorama cost guards", () => {
  it("bills at most once per coordinate (cache)", async () => {
    let calls = 0;
    const svc: FakeSvc = {
      getPanorama: (req, cb) => {
        calls++;
        cb({ location: { pano: `p${req.location.lat}`, latLng: {} }, tiles: { centerHeading: 0 } }, "OK");
      },
    };
    const a = await findPanorama(svc as unknown as google.maps.StreetViewService, 11.111111, 22.222222);
    const b = await findPanorama(svc as unknown as google.maps.StreetViewService, 11.111111, 22.222222);
    expect(calls).toBe(1);
    expect(a?.panoId).toBe(b?.panoId);

    await findPanorama(svc as unknown as google.maps.StreetViewService, 33.3, 44.4);
    expect(calls).toBe(2);
  });

  it("de-duplicates concurrent lookups for the same point", async () => {
    let calls = 0;
    const svc: FakeSvc = {
      getPanorama: (_req, cb) => {
        calls++;
        setTimeout(() => cb({ location: { pano: "x", latLng: {} }, tiles: {} }, "OK"), 5);
      },
    };
    const [x, y] = await Promise.all([
      findPanorama(svc as unknown as google.maps.StreetViewService, 55.5, 66.6),
      findPanorama(svc as unknown as google.maps.StreetViewService, 55.5, 66.6),
    ]);
    expect(calls).toBe(1);
    expect(x?.panoId).toBe(y?.panoId);
  });
});
