export const SYSTEM_ACTION_HOLD_MS = 1_800;

export function holdProgress(
  startedAt: number,
  currentTime: number,
  duration = SYSTEM_ACTION_HOLD_MS,
): number {
  if (!Number.isFinite(startedAt) || !Number.isFinite(currentTime) || duration <= 0) return 0;
  return Math.min(1, Math.max(0, (currentTime - startedAt) / duration));
}
