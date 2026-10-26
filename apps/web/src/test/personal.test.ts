import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { checkAppPassword, isAllowedUser, isPersonalMode } = await import("@/lib/personal");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("personal mode", () => {
  it("is off without APP_PASSWORD, and then any signed-in user is allowed", () => {
    vi.stubEnv("APP_PASSWORD", "");
    expect(isPersonalMode()).toBe(false);
    expect(checkAppPassword("")).toBe(false);
    expect(isAllowedUser("someone@x.com")).toBe(true);
  });

  it("checks the password and only allows the owner account", () => {
    vi.stubEnv("APP_PASSWORD", "rahasia-panjang-123");
    vi.stubEnv("OWNER_EMAIL", "Me@Example.com");
    expect(isPersonalMode()).toBe(true);
    expect(checkAppPassword("rahasia-panjang-123")).toBe(true);
    expect(checkAppPassword("rahasia-panjang-12")).toBe(false);
    expect(isAllowedUser("me@example.com")).toBe(true);
    expect(isAllowedUser("intruder@example.com")).toBe(false);
    expect(isAllowedUser(null)).toBe(false);
  });
});
