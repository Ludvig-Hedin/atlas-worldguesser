import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useHasKeyboard } from "./use-has-keyboard";

function mockPointer(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(pointer: fine)" ? matches : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe("useHasKeyboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts false before mount effects settle", () => {
    mockPointer(false);
    const { result } = renderHook(() => useHasKeyboard());
    // Effect runs synchronously in the testing-library act wrapper, so by the
    // time renderHook returns a coarse-pointer device has already resolved to
    // false — assert the initial/no-keyboard branch directly.
    expect(result.current).toBe(false);
  });

  it("is true immediately on a fine-pointer (mouse/trackpad) device", () => {
    mockPointer(true);
    const { result } = renderHook(() => useHasKeyboard());
    expect(result.current).toBe(true);
  });

  it("flips true after a real keydown on a coarse-pointer device", () => {
    mockPointer(false);
    const { result } = renderHook(() => useHasKeyboard());
    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });
    expect(result.current).toBe(true);
  });

  it("ignores synthetic 'Unidentified' keydowns", () => {
    mockPointer(false);
    const { result } = renderHook(() => useHasKeyboard());

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Unidentified" }));
    });
    expect(result.current).toBe(false);
  });
});
