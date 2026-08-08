import type { RecentVideoProgress } from "../types";

export const MAX_RECENT_VIDEO_PROGRESS = 3;
const MIN_RESUME_SECONDS = 5;
const COMPLETION_REMAINING_SECONDS = 15;

export function updateRecentVideoProgress(
  entries: RecentVideoProgress[],
  path: string,
  positionSeconds: number,
  durationSeconds: number,
  updatedAt = Date.now(),
): RecentVideoProgress[] {
  const withoutCurrent = entries.filter((entry) => entry.path.toLowerCase() !== path.toLowerCase());
  const position = Math.max(0, Math.floor(positionSeconds));
  const duration = Math.max(0, Math.floor(durationSeconds));
  if (!path || !Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds)) return withoutCurrent;
  if (position < MIN_RESUME_SECONDS || duration <= 0 || duration - position <= COMPLETION_REMAINING_SECONDS) {
    return withoutCurrent;
  }
  return [
    { path, positionSeconds: position, durationSeconds: duration, updatedAt: Math.max(0, Math.floor(updatedAt)) },
    ...withoutCurrent,
  ].slice(0, MAX_RECENT_VIDEO_PROGRESS);
}

export function resumablePosition(entry: RecentVideoProgress | undefined): number {
  if (!entry) return 0;
  if (entry.positionSeconds < MIN_RESUME_SECONDS) return 0;
  if (entry.durationSeconds - entry.positionSeconds <= COMPLETION_REMAINING_SECONDS) return 0;
  return entry.positionSeconds;
}
