import { describe, expect, it } from "vitest";
import { formatBytes, formatDuration } from "./format";

describe("formatBytes", () => {
  it("formats common media sizes", () => {
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(2_147_483_648)).toBe("2.00 GB");
    expect(formatBytes(null)).toBe("");
  });
});
describe("formatDuration", () => {
  it("handles short and long media", () => {
    expect(formatDuration(65)).toBe("01:05");
    expect(formatDuration(3661)).toBe("1:01:01");
    expect(formatDuration(Number.NaN)).toBe("00:00");
  });
});
