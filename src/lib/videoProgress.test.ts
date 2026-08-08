import { describe, expect, it } from "vitest";
import { resumablePosition, updateRecentVideoProgress } from "./videoProgress";

describe("recent video progress", () => {
  it("keeps the three most recently updated videos", () => {
    let entries = updateRecentVideoProgress([], "A.mp4", 20, 100, 1);
    entries = updateRecentVideoProgress(entries, "B.mp4", 30, 100, 2);
    entries = updateRecentVideoProgress(entries, "C.mp4", 40, 100, 3);
    entries = updateRecentVideoProgress(entries, "D.mp4", 50, 100, 4);

    expect(entries.map((entry) => entry.path)).toEqual(["D.mp4", "C.mp4", "B.mp4"]);
  });

  it("moves a replayed video to the front without duplicating it", () => {
    const initial = [
      { path: "A.mp4", positionSeconds: 20, durationSeconds: 100, updatedAt: 1 },
      { path: "B.mp4", positionSeconds: 30, durationSeconds: 100, updatedAt: 2 },
    ];
    const entries = updateRecentVideoProgress(initial, "a.MP4", 45, 100, 3);

    expect(entries).toHaveLength(2);
    expect(entries[0].positionSeconds).toBe(45);
  });

  it("does not resume from the opening or completed tail", () => {
    const opening = { path: "A.mp4", positionSeconds: 3, durationSeconds: 100, updatedAt: 1 };
    const completed = { path: "A.mp4", positionSeconds: 95, durationSeconds: 100, updatedAt: 1 };

    expect(resumablePosition(opening)).toBe(0);
    expect(resumablePosition(completed)).toBe(0);
    expect(updateRecentVideoProgress([completed], "A.mp4", 95, 100)).toEqual([]);
  });

  it("ignores progress without a finite position and duration", () => {
    const existing = [{ path: "A.mp4", positionSeconds: 20, durationSeconds: 100, updatedAt: 1 }];

    expect(updateRecentVideoProgress(existing, "B.mp4", Number.NaN, 100)).toEqual(existing);
    expect(updateRecentVideoProgress(existing, "B.mp4", 20, Number.POSITIVE_INFINITY)).toEqual(existing);
  });
});
