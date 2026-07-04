import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CluesReferenceSheet } from "./clues-reference-sheet";
import { CLUE_CATEGORIES } from "@/data/country-clues";

describe("CluesReferenceSheet", () => {
  it("renders nothing when closed", () => {
    render(<CluesReferenceSheet open={false} onOpenChange={() => {}} />);
    expect(screen.queryByText("What gives it away?")).not.toBeInTheDocument();
  });

  it("shows every clue category with a title and body when open", () => {
    render(<CluesReferenceSheet open onOpenChange={() => {}} />);
    expect(screen.getByText("What gives it away?")).toBeInTheDocument();
    for (const category of CLUE_CATEGORIES) {
      expect(screen.getByText(category.title)).toBeInTheDocument();
      expect(screen.getByText(category.body)).toBeInTheDocument();
    }
  });

  it("calls onOpenChange(false) when dismissed", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<CluesReferenceSheet open onOpenChange={onOpenChange} />);
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
