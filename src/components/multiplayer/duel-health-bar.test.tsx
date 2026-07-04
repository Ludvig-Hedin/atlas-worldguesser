import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DuelHealthBar } from "./duel-health-bar";
import type { Standing } from "./scoreboard";
import type { Id } from "@convex/_generated/dataModel";

function standing(overrides: Partial<Standing>): Standing {
  return {
    userId: "user_a" as Id<"users">,
    username: "Alice",
    totalScore: 0,
    isHost: false,
    connected: true,
    ready: true,
    hasGuessed: false,
    ...overrides,
  };
}

describe("DuelHealthBar", () => {
  it("shows both players' names and scores", () => {
    const me = standing({ userId: "user_a" as Id<"users">, username: "Alice", totalScore: 3000 });
    const opp = standing({ userId: "user_b" as Id<"users">, username: "Bob", totalScore: 1000 });
    render(<DuelHealthBar standings={[me, opp]} myUserId={"user_a" as Id<"users">} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("3,000")).toBeInTheDocument();
    expect(screen.getByText("1,000")).toBeInTheDocument();
  });

  it("falls back to an 'opponent left' state when only one standing remains", () => {
    const me = standing({ userId: "user_a" as Id<"users">, username: "Alice", totalScore: 1500 });
    render(<DuelHealthBar standings={[me]} myUserId={"user_a" as Id<"users">} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Opponent left")).toBeInTheDocument();
  });
});
