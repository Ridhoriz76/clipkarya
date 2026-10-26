import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { uuidParam, ApiError, errorResponse } = await import("@/lib/api");
const { formatPrice, formatDuration } = await import("@/lib/utils");
const { getDictionary } = await import("@/lib/i18n");

describe("api helpers", () => {
  it("validates uuid params", () => {
    expect(uuidParam.safeParse("not-a-uuid").success).toBe(false);
    expect(uuidParam.safeParse("8d3f2b1a-4c5e-4f6a-9b7c-1d2e3f4a5b6c").success).toBe(true);
  });

  it("returns user-safe messages and hides internal errors", async () => {
    const known = errorResponse(new ApiError(403, "Hanya admin.", "forbidden"));
    expect(known.status).toBe(403);
    expect(await known.json()).toMatchObject({ error: "Hanya admin.", code: "forbidden" });
    const internal = errorResponse(new Error("relation secret_table does not exist"));
    expect(internal.status).toBe(500);
    expect(JSON.stringify(await internal.json())).not.toContain("secret_table");
  });
});

describe("formatting & i18n", () => {
  it("formats IDR prices and free plans", () => {
    expect(formatPrice(0, "IDR")).toBe("Gratis");
    expect(formatPrice(9900000, "IDR").replace(/\s/g, " ")).toContain("99.000");
  });
  it("formats durations", () => {
    expect(formatDuration(65)).toBe("1:05");
  });
  it("falls back to Indonesian for unknown locales", () => {
    expect(getDictionary("fr")).toBe(getDictionary("id"));
    expect(getDictionary("en").nav.dashboard).not.toBe(getDictionary("id").nav.dashboard);
  });
});
