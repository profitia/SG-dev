export type CostPressureDirection = 'UPWARD' | 'DOWNWARD' | 'STABLE'

export type DriverCandidate = {
  name: string
  contributionPercentagePoints: number | null
}

function roundTo(value: number, fractionDigits = 6) {
  const factor = 10 ** fractionDigits
  return Math.round(value * factor) / factor
}

export function calculateBenchmarkChangePercent(startValue: number, endValue: number) {
  if (!Number.isFinite(startValue) || !Number.isFinite(endValue) || startValue === 0) {
    return null
  }

  return roundTo(((endValue / startValue) - 1) * 100)
}

export function calculateContributionPercentagePoints(weightPercent: number, benchmarkChangePercent: number) {
  if (!Number.isFinite(weightPercent) || !Number.isFinite(benchmarkChangePercent)) {
    return null
  }

  return roundTo((weightPercent / 100) * benchmarkChangePercent)
}

export function calculateCategoryMovementPercent(contributions: Array<number | null>) {
  if (contributions.some((value) => value === null)) {
    return null
  }

  return roundTo(contributions.reduce<number>((total, value) => total + (value ?? 0), 0))
}

export function deriveCostPressureDirection(categoryMovementPercent: number | null): CostPressureDirection | null {
  if (categoryMovementPercent === null) {
    return null
  }

  if (categoryMovementPercent > 0) {
    return 'UPWARD'
  }

  if (categoryMovementPercent < 0) {
    return 'DOWNWARD'
  }

  return 'STABLE'
}

export function findMainUpwardDriver(candidates: DriverCandidate[]) {
  const validCandidates = candidates.filter(
    (candidate): candidate is DriverCandidate & { contributionPercentagePoints: number } =>
      candidate.contributionPercentagePoints !== null && candidate.contributionPercentagePoints > 0,
  )

  if (validCandidates.length === 0) {
    return null
  }

  return validCandidates.reduce((best, candidate) =>
    candidate.contributionPercentagePoints > best.contributionPercentagePoints ? candidate : best,
  )
}

export function findMainDownwardDriver(candidates: DriverCandidate[]) {
  const validCandidates = candidates.filter(
    (candidate): candidate is DriverCandidate & { contributionPercentagePoints: number } =>
      candidate.contributionPercentagePoints !== null && candidate.contributionPercentagePoints < 0,
  )

  if (validCandidates.length === 0) {
    return null
  }

  return validCandidates.reduce((best, candidate) =>
    candidate.contributionPercentagePoints < best.contributionPercentagePoints ? candidate : best,
  )
}