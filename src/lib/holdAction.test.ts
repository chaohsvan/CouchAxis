import { describe, expect, it } from "vitest";
import { holdProgress, SYSTEM_ACTION_HOLD_MS } from "./holdAction";

describe("holdProgress", () => {
  it("clamps progress before and after the hold interval", () => {
    expect(holdProgress(1_000, 900)).toBe(0);
    expect(holdProgress(1_000, 1_000 + SYSTEM_ACTION_HOLD_MS / 2)).toBe(0.5);
    expect(holdProgress(1_000, 1_000 + SYSTEM_ACTION_HOLD_MS)).toBe(1);
    expect(holdProgress(1_000, 9_000)).toBe(1);
  });

  it("rejects invalid timing input", () => {
    expect(holdProgress(Number.NaN, 1_000)).toBe(0);
    expect(holdProgress(0, 1_000, 0)).toBe(0);
  });
});
