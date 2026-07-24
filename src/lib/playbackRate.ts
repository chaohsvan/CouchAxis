export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4] as const;

export function stepPlaybackRate(current: number, direction: -1 | 1): number {
  const closestIndex = PLAYBACK_RATES.reduce((bestIndex, rate, index) => (
    Math.abs(rate - current) < Math.abs(PLAYBACK_RATES[bestIndex] - current) ? index : bestIndex
  ), 0);
  const nextIndex = Math.min(PLAYBACK_RATES.length - 1, Math.max(0, closestIndex + direction));
  return PLAYBACK_RATES[nextIndex];
}
