import { describe, expect, it } from "vitest";
import { screenshotFileName, subtitleFontScale } from "./screenshots";

describe("screenshot file names", () => {
  it("includes the video stem, wall clock, and playback position", () => {
    const date = new Date(2026, 6, 24, 9, 8, 7);
    expect(screenshotFileName("My.Movie.mkv", date, 3723.9)).toBe(
      "My.Movie_20260724-090807_01-02-03.png",
    );
  });
});

describe("screenshot subtitle size", () => {
  it("uses ordered scale factors for the three persisted settings", () => {
    expect(subtitleFontScale("small")).toBeLessThan(subtitleFontScale("medium"));
    expect(subtitleFontScale("medium")).toBe(1);
    expect(subtitleFontScale("large")).toBeGreaterThan(subtitleFontScale("medium"));
  });
});
