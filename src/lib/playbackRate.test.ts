import { describe, expect, it } from "vitest";
import { stepPlaybackRate } from "./playbackRate";

describe("video playback rates", () => {
  it("steps through supported rates and clamps at both ends", () => {
    expect(stepPlaybackRate(1, 1)).toBe(1.25);
    expect(stepPlaybackRate(1, -1)).toBe(0.75);
    expect(stepPlaybackRate(2, 1)).toBe(2.5);
    expect(stepPlaybackRate(2.5, 1)).toBe(3);
    expect(stepPlaybackRate(3, 1)).toBe(4);
    expect(stepPlaybackRate(4, 1)).toBe(4);
    expect(stepPlaybackRate(0.5, -1)).toBe(0.5);
  });
});
