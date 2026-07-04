import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { toast } from "sonner";
import { translate } from "@/lib/i18n";
import { levelProgress } from "@/lib/xp";
import { MatchResults } from "./match-results";
import type { ApplyResult } from "@/lib/local-profile";
import type { SoloGame } from "@/hooks/use-solo-game";

// The level-up toast is the unit under test — keep the surrounding component
// cheap and deterministic by stubbing the noisy dependencies (map renderer,
// Convex/Clerk hooks) and pinning the translator to English.
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("./match-map", () => ({ MatchMap: () => null }));
vi.mock("@convex/_generated/api", () => ({ api: { users: { setAvatar: "setAvatar" } } }));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: false }),
  useMutation: () => vi.fn(),
}));
vi.mock("@clerk/nextjs", () => ({
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/hooks/use-t", async () => {
  const { translate: real } = await import("@/lib/i18n");
  return {
    useT: () => (key: string, params?: Record<string, string | number>) =>
      real("en", key as never, params as never),
  };
});

const XP = 4200; // arbitrary; the level is derived from it below

const game = {
  id: "g1",
  mapId: "world",
  mode: "classic",
  settings: { rounds: 5 },
  results: [],
} as unknown as SoloGame;

function makeApplied(leveledUp: boolean): ApplyResult {
  return {
    profile: { stats: { xp: XP } },
    xpGained: 1200,
    newAchievements: [],
    newBuildings: [],
    leveledUp,
    won: true,
    totalScore: 12000,
  } as unknown as ApplyResult;
}

describe("MatchResults level-up celebration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fires a level-up toast exactly once when applied.leveledUp is true", () => {
    render(
      <MatchResults
        game={game}
        applied={makeApplied(true)}
        onPlayAgain={() => {}}
        onNewGame={() => {}}
      />,
    );
    const expected = translate("en", "match.levelUp", {
      level: levelProgress(XP).level,
    });
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(expected);
  });

  it("does not fire when applied.leveledUp is false", () => {
    render(
      <MatchResults
        game={game}
        applied={makeApplied(false)}
        onPlayAgain={() => {}}
        onNewGame={() => {}}
      />,
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("does not re-fire on re-render with the same result", () => {
    const applied = makeApplied(true);
    const { rerender } = render(
      <MatchResults game={game} applied={applied} onPlayAgain={() => {}} onNewGame={() => {}} />,
    );
    rerender(
      <MatchResults game={game} applied={applied} onPlayAgain={() => {}} onNewGame={() => {}} />,
    );
    expect(toast.success).toHaveBeenCalledTimes(1);
  });
});
