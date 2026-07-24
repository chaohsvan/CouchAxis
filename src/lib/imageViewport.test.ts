import { describe, expect, it } from "vitest";
import { clampImagePan, imageViewportMetrics, mangaStartPan } from "./imageViewport";

describe("image viewport", () => {
  it("fits the complete image inside the viewport", () => {
    const metrics = imageViewportMetrics(
      { width: 2000, height: 1000 },
      { width: 1000, height: 700 },
      0,
      1,
      40,
    );
    expect(metrics.renderedWidth).toBe(960);
    expect(metrics.renderedHeight).toBe(480);
    expect(metrics.maxPanX).toBe(0);
    expect(metrics.maxPanY).toBe(0);
  });

  it("clamps panning and anchors zoomed pages to either top corner", () => {
    const metrics = imageViewportMetrics(
      { width: 1600, height: 2400 },
      { width: 1000, height: 700 },
      0,
      4,
      40,
    );
    expect(mangaStartPan(metrics, "left")).toEqual({ x: metrics.maxPanX, y: metrics.maxPanY });
    expect(mangaStartPan(metrics, "right")).toEqual({ x: -metrics.maxPanX, y: metrics.maxPanY });
    expect(clampImagePan({ x: 99999, y: -99999 }, metrics)).toEqual({
      x: metrics.maxPanX,
      y: -metrics.maxPanY,
    });
  });
});
