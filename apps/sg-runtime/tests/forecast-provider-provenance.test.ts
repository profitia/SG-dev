import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  BenchmarkCandidate,
  BenchmarkHistoricalSeriesResult,
} from '../lib/benchmark/contracts'
import { createMacrobondForecastProvenanceResolver } from '../lib/forecast/provider-provenance'

function history(overrides: Partial<BenchmarkHistoricalSeriesResult> = {}): BenchmarkHistoricalSeriesResult {
  return {
    providerSeries: {
      provider: { providerCode: 'MACROBOND', displayName: 'Macrobond' },
      providerSeriesId: 'generic.quarterly.stock',
      providerSeriesKey: 'generic.quarterly.stock',
    },
    displayName: 'Generic quarterly stock',
    frequency: 'quarterly',
    currency: 'usd',
    unit: null,
    source: 'src_provider',
    historical: [],
    ...overrides,
  }
}

function candidate(overrides: Partial<BenchmarkCandidate> = {}): BenchmarkCandidate {
  return {
    candidateId: 'macrobond:generic.quarterly.stock',
    displayName: 'Generic quarterly stock',
    description: null,
    provider: { providerCode: 'MACROBOND', displayName: 'Macrobond' },
    providerSeries: {
      provider: { providerCode: 'MACROBOND', displayName: 'Macrobond' },
      providerSeriesId: 'generic.quarterly.stock',
      providerSeriesKey: 'generic.quarterly.stock',
    },
    frequency: 'Quarterly',
    currency: 'USD',
    unit: null,
    source: 'Provider source',
    region: 'Region',
    exactMatch: true,
    metadata: {
      Frequency: 'quarterly',
      Class: 'stock',
      Source: 'src_provider',
      Release: 'rel_provider_quarterly',
    },
    ...overrides,
  }
}

test('exact Macrobond native stock metadata proves only period-end provenance', async () => {
  const resolver = createMacrobondForecastProvenanceResolver(async () => candidate())
  const provenance = await resolver('generic.quarterly.stock', history())

  assert.equal(provenance.length, 1)
  assert.equal(provenance[0]?.sourceFrequency, 'QUARTERLY')
  assert.equal(provenance[0]?.targetSemantics, 'END_OF_PERIOD')
  assert.equal(provenance[0]?.preparation.provenanceStatus, 'PROVEN')
  assert.equal(provenance[0]?.levelAtTimestamp, true)
  assert.equal(provenance[0]?.exactSourceObservedAt, true)
  assert.equal(provenance.some((item) => item.targetSemantics === 'MONTHLY_AVERAGE'), false)
})

test('Macrobond provenance fails closed for non-stock or mismatched provider metadata', async () => {
  const flowResolver = createMacrobondForecastProvenanceResolver(async () => candidate({
    metadata: {
      Frequency: 'quarterly',
      Class: 'flow',
      Source: 'src_provider',
      Release: 'rel_provider_quarterly',
    },
  }))
  const wrongFrequencyResolver = createMacrobondForecastProvenanceResolver(async () => candidate({
    frequency: 'Monthly',
    metadata: {
      Frequency: 'monthly',
      Class: 'stock',
      Source: 'src_provider',
      Release: 'rel_provider_monthly',
    },
  }))

  assert.deepEqual(await flowResolver('generic.quarterly.stock', history()), [])
  assert.deepEqual(await wrongFrequencyResolver('generic.quarterly.stock', history()), [])
})