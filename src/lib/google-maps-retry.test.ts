import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({
  googleMapsBrowserKey: "test-key",
  googleMapsDisabled: false,
}));

function firstScript(): HTMLScriptElement {
  const el = document.head.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com"]');
  if (!el) throw new Error("expected a Google Maps script tag to be appended");
  return el;
}

describe("loadGoogleMaps retry on a flaky connection", () => {
  beforeEach(() => {
    vi.resetModules();
    document.head.innerHTML = "";
    delete (window as unknown as { google?: unknown }).google;
  });

  it("retries once after a script error, then resolves on the second attempt", async () => {
    const { loadGoogleMaps } = await import("./google-maps");
    const promise = loadGoogleMaps();

    const attempt1 = firstScript();
    attempt1.onerror!(new Event("error"));
    // Retry appends a fresh script tag on a fresh microtask.
    await Promise.resolve();
    await Promise.resolve();

    const attempt2 = firstScript();
    expect(attempt2).not.toBe(attempt1);

    const fakeGoogle = { maps: {} } as unknown as typeof google;
    (window as unknown as { google?: unknown }).google = fakeGoogle;
    (window as unknown as Record<string, () => void>).__atlasGmapsReady();

    await expect(promise).resolves.toBe(fakeGoogle);
  });

  it("rejects once the retry also fails", async () => {
    const { loadGoogleMaps } = await import("./google-maps");
    const promise = loadGoogleMaps();

    firstScript().onerror!(new Event("error"));
    await Promise.resolve();
    await Promise.resolve();
    firstScript().onerror!(new Event("error"));

    await expect(promise).rejects.toThrow("Failed to load Google Maps JS API");
  });
});
