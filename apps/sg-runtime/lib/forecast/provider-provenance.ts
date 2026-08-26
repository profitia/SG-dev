import {
  lookupMacrobondSeriesExact,
} from '@/lib/benchmark/macrobond'
import type {
  BenchmarkCandidate,
  BenchmarkHistoricalSeriesResult,
} from '@/lib/benchmark/contracts'
import {
  normalizeForecastSourceFrequency,
} from '@/lib/forecast/cadence'
import type { ForecastCapabilityProvenance } from '@/lib/forecast/capability-resolver'

type ExactSeriesLookup = (seriesId: string) => Promise<BenchmarkCandidate | null>

function metadataValue(candidate: BenchmarkCandidate, key: string) {
  const value = candidate.metadata?.[key]
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export function createMacrobondForecastProvenanceResolver(
  lookupExact: ExactSeriesLookup = lookupMacrobondSeriesExact,
) {
  return async (
    seriesId: string,
    history: BenchmarkHistoricalSeriesResult,
  ): Promise<readonly ForecastCapabilityProvenance[]> => {
    if (
      history.providerSeries.provider.providerCode !== 'MACROBOND'
      || history.providerSeries.providerSeriesId !== seriesId
    ) {
      return []
    }

    let candidate: BenchmarkCandidate | null
    try {
      candidate = await lookupExact(seriesId)
    } catch {
      return []
    }
    if (
      !candidate
      || candidate.exactMatch !== true
      || candidate.provider.providerCode !== 'MACROBOND'
      || candidate.providerSeries.providerSeriesId !== seriesId
    ) {
      return []
    }

    const historyFrequency = normalizeForecastSourceFrequency(history.frequency)
    const providerFrequency = normalizeForecastSourceFrequency(
      metadataValue(candidate, 'Frequency') ?? candidate.frequency,
    )
    if (!historyFrequency || providerFrequency !== historyFrequency) {
      return []
    }

    const sourceClass = metadataValue(candidate, 'Class')?.trim().toLowerCase()
    const sourceCode = metadataValue(candidate, 'Source')
    const releaseCode = metadataValue(candidate, 'Release')
    if (sourceClass !== 'stock' || !sourceCode || !releaseCode) {
      return []
    }

    return [{
      sourceFrequency: historyFrequency,
      targetSemantics: 'END_OF_PERIOD',
      preparation: {
        method: 'MACROBOND_NATIVE_PERIOD_END_LEVEL',
        version: 'macrobond-native-period-provenance-v1',
        provenanceStatus: 'PROVEN',
      },
      sourceLineage: `MACROBOND:${seriesId}:${sourceCode}:${releaseCode}`,
      closedPeriod: true,
      levelAtTimestamp: true,
      exactSourceObservedAt: true,
      aggregation: null,
      underlyingObservationFrequency: null,
      missingObservationPolicy: null,
      syntheticObservations: null,
    }]
  }
}

export const resolveMacrobondForecastProvenance = createMacrobondForecastProvenanceResolver()