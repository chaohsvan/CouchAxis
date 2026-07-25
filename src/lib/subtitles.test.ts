import { describe, expect, it } from "vitest";
import { activeSubtitle, parseSubtitles } from "./subtitles";

describe("parseSubtitles", () => {
  it("parses SRT cues", () => {
    const cues = parseSubtitles("movie.srt", "1\n00:00:01,500 --> 00:00:03,000\nHello\nworld\n");
    expect(cues).toEqual([{ start: 1.5, end: 3, text: "Hello\nworld" }]);
    expect(activeSubtitle(cues, 2)).toBe("Hello\nworld");
  });

  it("parses ASS dialogue and removes override tags", () => {
    const contents = "Dialogue: 0,0:00:02.00,0:00:04.50,Default,,0,0,0,,{\\i1}Hello\\Nthere";
    expect(parseSubtitles("movie.ass", contents)).toEqual([{ start: 2, end: 4.5, text: "Hello\nthere" }]);
  });

  it("keeps every active line when subtitle cues overlap", () => {
    const cues = [
      { start: 1, end: 4, text: "First complete line" },
      { start: 2, end: 3, text: "第二行完整字幕" },
    ];

    expect(activeSubtitle(cues, 2.5)).toBe("First complete line\n第二行完整字幕");
  });
});
