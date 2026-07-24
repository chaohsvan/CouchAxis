import type { SubtitleCue } from "../types";

function parseClock(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  const parts = normalized.split(":").map(Number);
  if (parts.length < 2 || parts.some(Number.isNaN)) return null;
  const seconds = parts.pop() ?? 0;
  const minutes = parts.pop() ?? 0;
  const hours = parts.pop() ?? 0;
  return hours * 3600 + minutes * 60 + seconds;
}
function cleanText(value: string): string {
  return value
    .replace(/\\N/gi, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/\{[^}]*\}/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function parseSrt(contents: string): SubtitleCue[] {
  return contents
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .flatMap((block) => {
      const lines = block.split("\n");
      const timingIndex = lines.findIndex((line) => line.includes("-->"));
      if (timingIndex < 0) return [];
      const [startValue, endValue] = lines[timingIndex].split("-->");
      const start = parseClock(startValue);
      const end = parseClock(endValue);
      const text = cleanText(lines.slice(timingIndex + 1).join("\n"));
      return start === null || end === null || !text ? [] : [{ start, end, text }];
    });
}

function parseAss(contents: string): SubtitleCue[] {
  return contents
    .replace(/\r/g, "")
    .split("\n")
    .flatMap((line) => {
      if (!/^Dialogue\s*:/i.test(line)) return [];
      const fields = line.slice(line.indexOf(":") + 1).split(",");
      if (fields.length < 10) return [];
      const start = parseClock(fields[1]);
      const end = parseClock(fields[2]);
      const text = cleanText(fields.slice(9).join(","));
      return start === null || end === null || !text ? [] : [{ start, end, text }];
    });
}

export function parseSubtitles(fileName: string, contents: string): SubtitleCue[] {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const cues = extension === "ass" || extension === "ssa" ? parseAss(contents) : parseSrt(contents);
  return cues.sort((left, right) => left.start - right.start);
}

export function activeSubtitle(cues: SubtitleCue[], currentTime: number): string {
  return cues.find((cue) => currentTime >= cue.start && currentTime <= cue.end)?.text ?? "";
}
