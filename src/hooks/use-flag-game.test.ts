import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFlagGame } from "./use-flag-game";

const pool = ["FR", "JP", "AU"];

describe("useFlagGame — history persists across rounds", () => {
  it("keeps a round's final status in pastStatus after next() clears the live status", () => {
    const { result } = renderHook(() => useFlagGame({ regionId: "world", pool, length: 2 }));

    const [first, second] = result.current.state.flags;
    const wrongIso = pool.find((iso) => iso !== first && iso !== second)!;

    act(() => result.current.guess(wrongIso));
    act(() => result.current.guess(first));

    // Round 1 revealed: live status carries the tiered wrong click + the answer.
    expect(result.current.status[wrongIso]).toBe("wrong1");
    expect(result.current.status[first]).toBe("correct");
    expect(result.current.pastStatus).toEqual({});

    act(() => result.current.next());

    // Round advances: live status resets for the new round...
    expect(result.current.status).toEqual({});
    // ...but round 1's countries are preserved (muted) in pastStatus.
    expect(result.current.pastStatus[wrongIso]).toBe("wrong1");
    expect(result.current.pastStatus[first]).toBe("correct");
  });

  it("keeps a failed round's revealed answer in pastStatus too", () => {
    const { result } = renderHook(() => useFlagGame({ regionId: "world", pool: [...pool, "BR"], length: 2 }));

    const target = result.current.state.flags[0];
    const others = ["FR", "JP", "AU", "BR"].filter((iso) => iso !== target);

    // Exhaust all wrong attempts (FLAG_MAX_WRONG = 3) without ever guessing right.
    act(() => result.current.guess(others[0]));
    act(() => result.current.guess(others[1]));
    act(() => result.current.guess(others[2]));

    expect(result.current.state.phase).toBe("revealed");
    act(() => result.current.next());

    expect(result.current.pastStatus[target]).toBe("revealed");
    others.forEach((iso, i) => {
      expect(result.current.pastStatus[iso]).toBe(i === 0 ? "wrong1" : i === 1 ? "wrong2" : "wrong3");
    });
  });

  it("clears history on restart", () => {
    const { result } = renderHook(() => useFlagGame({ regionId: "world", pool, length: 1 }));
    const iso = result.current.state.flags[0];
    act(() => result.current.guess(iso));
    act(() => result.current.next());
    expect(Object.keys(result.current.pastStatus).length).toBeGreaterThan(0);

    act(() => result.current.restart());
    expect(result.current.pastStatus).toEqual({});
  });
});
