export type ValueDomain = {
  minimum: number
  maximum: number
}

const DOMAIN_PADDING_RATIO = 0.12
const MINIMUM_DOMAIN_PADDING = 1

export function resolvePaddedValueDomain(values: number[]): ValueDomain {
  if (values.length === 0) {
    return { minimum: 0, maximum: 1 }
  }

  const minimum = Math.min(...values)
  const maximum = Math.max(...values)

  if (minimum === maximum) {
    const padding = Math.max(Math.abs(minimum) * DOMAIN_PADDING_RATIO, MINIMUM_DOMAIN_PADDING)

    return {
      minimum: minimum - padding,
      maximum: maximum + padding,
    }
  }

  const padding = Math.max((maximum - minimum) * DOMAIN_PADDING_RATIO, MINIMUM_DOMAIN_PADDING)

  return {
    minimum: minimum - padding,
    maximum: maximum + padding,
  }
}

export function shouldCommitZoomSelection(startX: number, currentX: number, thresholdPx: number) {
  return Math.abs(currentX - startX) >= thresholdPx
}

export function shouldTogglePinnedSurface(
  currentKey: string | null,
  currentVariant: string | null,
  nextKey: string,
  nextVariant: string,
) {
  return currentKey === nextKey && currentVariant === nextVariant
}