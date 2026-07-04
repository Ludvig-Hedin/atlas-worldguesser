import { describe, expect, it } from "vitest";
import { isTestUser } from "./users";

describe("isTestUser", () => {
  it("flags accounts with clerk_test in the email", () => {
    expect(isTestUser({ username: "ludvig", email: "ludvig+clerk_test@example.com" })).toBe(true);
  });

  it("flags accounts with clerk_test in the username", () => {
    expect(isTestUser({ username: "clerk_test_1", email: undefined })).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isTestUser({ username: "player", email: "player+CLERK_TEST@example.com" })).toBe(true);
  });

  it("does not flag regular accounts", () => {
    expect(isTestUser({ username: "ludvig", email: "ludvig@ludvighedin.com" })).toBe(false);
    expect(isTestUser({ username: "player", email: undefined })).toBe(false);
  });
});
