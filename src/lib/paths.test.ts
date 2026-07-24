import { describe, expect, it } from "vitest";
import { directoryName } from "./paths";

describe("directoryName", () => {
  it("returns the parent of Windows media paths", () => {
    expect(directoryName("D:\\Movies\\After the Rain.mkv")).toBe("D:\\Movies");
    expect(directoryName("C:\\movie.mp4")).toBe("C:\\");
  });

  it("supports future Unix media paths", () => {
    expect(directoryName("/mnt/media/movie.mkv")).toBe("/mnt/media");
    expect(directoryName("/movie.mkv")).toBe("/");
  });
});
