import { describe, expect, it } from "vitest";
import { activeLyricsIndex, parseEmbeddedLyrics } from "./lyrics";

describe("embedded lyrics", () => {
  it("parses and orders LRC timestamps", () => {
    const lyrics = parseEmbeddedLyrics("[ar:Artist]\n[00:05.20]Second\n[00:01.00]First");
    expect(lyrics.synced).toBe(true);
    expect(lyrics.lines).toEqual([
      { time: 1, text: "First" },
      { time: 5.2, text: "Second" },
    ]);
    expect(activeLyricsIndex(lyrics, 5.3, 10)).toBe(1);
  });

  it("scrolls plain lyrics by playback progress", () => {
    const lyrics = parseEmbeddedLyrics("First\nSecond\nThird\nFourth");
    expect(lyrics.synced).toBe(false);
    expect(activeLyricsIndex(lyrics, 51, 100)).toBe(2);
  });

  it("applies LRC offsets and ignores metadata", () => {
    const lyrics = parseEmbeddedLyrics("[offset:500]\n[ti:Title]\n[00:01.00]Line");
    expect(lyrics.lines).toEqual([{ time: 1.5, text: "Line" }]);
  });
});
