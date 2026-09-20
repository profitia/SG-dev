import type {
  ForecastVerificationMetrics,
  ForecastVerificationRecord,
} from '@/lib/forecast/contracts'

function average(values: number[]) {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length
}

/**
 * Calculates the canonical verification metrics from already persisted,
 * lawful comparable records. sMAPE is expressed in percentage points, which
 * matches Forecast Tooling and the persisted period-verification contract.
 */
export function calculateForecastVerificationMetrics(
  records: ForecastVerificationRecord[],
): ForecastVerificationMetrics | null {
  if (records.length === 0) {
    return null
  }

  const rmseBase = average(records.map((record) => record.error ** 2))
  const maseValues = records
    .filter((record) => record.maseScale > 0)
    .map((record) => record.absoluteError / record.maseScale)
  const smapeValues = records
    .map((record) => {
      const denominator = Math.abs(record.forecastValue) + Math.abs(record.actualValue)
      return denominator === 0 ? 0 : ((2 * record.absoluteError) / denominator) * 100
    })
    .filter((value) => Number.isFinite(value))

  return {
    mae: average(records.map((record) => record.absoluteError)),
    rmse: rmseBase === null ? null : Math.sqrt(rmseBase),
    mase: average(maseValues),
    smape: average(smapeValues),
    directionalAccuracy: average(records.map((record) => {
      const forecastDirection = Math.sign(record.forecastValue - record.originValue)
      const actualDirection = Math.sign(record.actualValue - record.originValue)
      return forecastDirection === actualDirection ? 1 : 0
    })),
    bias: average(records.map((record) => record.error)),
  }
}
