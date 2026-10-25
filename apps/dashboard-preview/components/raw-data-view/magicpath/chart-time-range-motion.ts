/** C74/B53: move one time window without changing its width. */
export type ChartTimeRange = [number, number];
export function rangePanLimits(range: ChartTimeRange, max: number, boundaryIndex?: number): ChartTimeRange {
  const lower = -range[0];
  const upper = max - range[1];
  return boundaryIndex === undefined ? [lower, upper] : [
    Math.max(lower, boundaryIndex + 1 - range[1]),
    Math.min(upper, boundaryIndex - 1 - range[0])
  ];
}
export function panTimeRange(range: ChartTimeRange, delta: number, max: number, boundaryIndex?: number): ChartTimeRange {
  const [lower, upper] = rangePanLimits(range, max, boundaryIndex);
  const shift = Math.min(upper, Math.max(lower, delta));
  return [range[0] + shift, range[1] + shift];
}
