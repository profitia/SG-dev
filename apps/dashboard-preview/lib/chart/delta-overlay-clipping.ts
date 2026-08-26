import type { TimeSeriesViewerDeltaOverlay } from '@/lib/time-series-viewer/time-series-viewer-contract'

export type TimeSeriesViewerVisibleRange = {
  start: string
  end: string
}

function toMs(value: string) {
  return new Date(value).getTime()
}

function interpolatePoint(
  left: TimeSeriesViewerDeltaOverlay['points'][number],
  right: TimeSeriesViewerDeltaOverlay['points'][number],
  targetMs: number,
) {
  const leftMs = toMs(left.date)
  const rightMs = toMs(right.date)

  if (targetMs <= leftMs) {
    return left
  }

  if (targetMs >= rightMs) {
    return right
  }

  const ratio = (targetMs - leftMs) / Math.max(rightMs - leftMs, 1)

  return {
    date: new Date(targetMs).toISOString(),
    value: left.value + ((right.value - left.value) * ratio),
  }
}

export function clipDeltaOverlayToRange(
  overlay: TimeSeriesViewerDeltaOverlay,
  range: TimeSeriesViewerVisibleRange | null,
) {
  if (!range || overlay.points.length < 4) {
    return overlay
  }

  const [actualStart, actualEnd, forecastEnd, forecastStart] = overlay.points

  if (!actualStart || !actualEnd || !forecastEnd || !forecastStart) {
    return null
  }

  const leftMs = toMs(actualStart.date)
  const rightMs = toMs(actualEnd.date)
  const rangeStartMs = toMs(range.start)
  const rangeEndMs = toMs(range.end)

  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs) || !Number.isFinite(rangeStartMs) || !Number.isFinite(rangeEndMs)) {
    return null
  }

  if (rightMs < rangeStartMs || leftMs > rangeEndMs) {
    return null
  }

  if (leftMs === rightMs) {
    return leftMs >= rangeStartMs && leftMs <= rangeEndMs ? overlay : null
  }

  const clippedStartMs = Math.max(leftMs, rangeStartMs)
  const clippedEndMs = Math.min(rightMs, rangeEndMs)

  if (clippedStartMs > clippedEndMs) {
    return null
  }

  const clippedActualStart = interpolatePoint(actualStart, actualEnd, clippedStartMs)
  const clippedActualEnd = interpolatePoint(actualStart, actualEnd, clippedEndMs)
  const clippedForecastStart = interpolatePoint(forecastStart, forecastEnd, clippedStartMs)
  const clippedForecastEnd = interpolatePoint(forecastStart, forecastEnd, clippedEndMs)

  return {
    ...overlay,
    points: [clippedActualStart, clippedActualEnd, clippedForecastEnd, clippedForecastStart],
  }
}

export function clipDeltaOverlaysToRange(
  overlays: TimeSeriesViewerDeltaOverlay[],
  range: TimeSeriesViewerVisibleRange | null,
) {
  return overlays
    .map((overlay) => clipDeltaOverlayToRange(overlay, range))
    .filter((overlay): overlay is TimeSeriesViewerDeltaOverlay => overlay !== null)
}