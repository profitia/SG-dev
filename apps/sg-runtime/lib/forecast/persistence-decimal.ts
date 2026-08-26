import { Prisma } from '@/generated/market-data-client'

import type { ForecastVerificationRecord } from '@/lib/forecast/contracts'

export const FORECAST_LIBRARY_DECIMAL_PRECISION = 24
export const FORECAST_LIBRARY_DECIMAL_SCALE = 8
export const FORECAST_LIBRARY_DECIMAL_ROUNDING_MODE = Prisma.Decimal.ROUND_HALF_UP

type DecimalInput = number | string | Prisma.Decimal

export function normalizeForecastLibraryDecimal(value: DecimalInput) {
  const decimal = Prisma.Decimal.isDecimal(value) ? value : new Prisma.Decimal(value)
  return decimal.toDecimalPlaces(FORECAST_LIBRARY_DECIMAL_SCALE, FORECAST_LIBRARY_DECIMAL_ROUNDING_MODE)
}

export function buildVerificationPersistenceDecimals(
  record: Pick<ForecastVerificationRecord, 'originValue' | 'forecastValue' | 'actualValue'>,
) {
  const originValue = normalizeForecastLibraryDecimal(record.originValue)
  const forecastValue = normalizeForecastLibraryDecimal(record.forecastValue)
  const actualValue = normalizeForecastLibraryDecimal(record.actualValue)
  const deltaValue = normalizeForecastLibraryDecimal(forecastValue.minus(actualValue))

  return {
    originValue,
    forecastValue,
    actualValue,
    errorValue: deltaValue,
    absoluteErrorValue: normalizeForecastLibraryDecimal(deltaValue.abs()),
    deltaValue,
  }
}