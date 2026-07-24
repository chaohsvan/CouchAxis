export interface LyricsLine {
  time: number | null;
  text: string;
}

export interface LyricsDocument {
  synced: boolean;
  lines: LyricsLine[];
}

const TIME_TAG = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const METADATA_TAG = /^\[(ar|al|ti|by|re|ve|length):/i;

export function parseEmbeddedLyrics(contents: string | null): LyricsDocument {
  if (!contents?.trim()) return { synced: false, lines: [] };

  const offsetMatch = contents.match(/\[offset:([+-]?\d+)\]/i);
  const offset = offsetMatch ? Number(offsetMatch[1]) / 1000 : 0;
  const timedLines: LyricsLine[] = [];
  const plainLines: LyricsLine[] = [];

  contents.replace(/\r\n?/g, "\n").split("\n").forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || METADATA_TAG.test(line) || /^\[offset:/i.test(line)) return;

    const timestamps = [...line.matchAll(TIME_TAG)];
    const text = line.replace(TIME_TAG, "").trim();
    if (timestamps.length > 0 && text) {
      timestamps.forEach((match) => {
        const fraction = match[3] ? Number(match[3]) / (10 ** match[3].length) : 0;
        const time = Number(match[1]) * 60 + Number(match[2]) + fraction + offset;
        timedLines.push({ time: Math.max(0, time), text });
      });
    } else if (text) {
      plainLines.push({ time: null, text });
    }
  });

  if (timedLines.length > 0) {
    timedLines.sort((left, right) => (left.time ?? 0) - (right.time ?? 0));
    return { synced: true, lines: timedLines };
  }
  return { synced: false, lines: plainLines };
}

export function activeLyricsIndex(
  lyrics: LyricsDocument,
  currentTime: number,
  duration: number,
): number {
  if (lyrics.lines.length === 0) return -1;
  if (!lyrics.synced) {
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    return Math.min(lyrics.lines.length - 1, Math.floor((currentTime / duration) * lyrics.lines.length));
  }

  let active = 0;
  for (let index = 0; index < lyrics.lines.length; index += 1) {
    if ((lyrics.lines[index].time ?? 0) > currentTime) break;
    active = index;
  }
  return active;
}
