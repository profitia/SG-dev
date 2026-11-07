import assert from 'node:assert/strict'
import test from 'node:test'

import type { BenchmarkMetadataDefinition } from '../lib/benchmark/contracts'
import {
  METADATA_DICTIONARY_FILTER_SIGNATURE,
  METADATA_QUERY_DELAY_MS,
  createMetadataValueLoadQueue,
  normalizeMetadataValueQuery,
  buildMetadataValueRequestKey,
  buildMetadataValuesRequestPath,
  countReadyMetadataPrewarmFacets,
  getStandardMetadataPrewarmKeys,
  isDuplicateMetadataValueRequest,
  prepareAdvancedMetadata,
  shouldReuseMetadataValueState,
  shouldUseRemoteMetadataQuery,
} from '../components/benchmark-finder/metadata-prefetch'

function definition(key: string): BenchmarkMetadataDefinition {
  return {
    key,
    label: key,
    description: null,
    searchable: true,
    featured: true,
    category: 'business',
    controlType: 'single-select',
    allowMultipleValues: false,
    providerKey: key,
  }
}

test('typing in a prewarmed local dictionary reuses the same ready request state', () => {
  for (const key of ['Source', 'Frequency', 'Currency', 'TitleUnit', 'Category']) {
    for (const input of ['', 'D', 'Daily', 'Monthly']) {
      const query = normalizeMetadataValueQuery(key, input)
      assert.equal(query, '')
      assert.equal(shouldReuseMetadataValueState({ status: 'ready', query: '', filterSignature: '[]' }, '[]', query), true)
    }
  }
  assert.equal(normalizeMetadataValueQuery('Region', ' Poland '), 'Poland')
})

test('a typing burst dispatches only its final remote dictionary query after the pause', (t) => {
  t.mock.timers.enable()
  const queue = createMetadataValueLoadQueue(), requests: string[] = []
  const input = 'zzzzfindernomatch20261104'
  for (let length = 1; length <= input.length; length += 1) {
    const query = input.slice(0, length)
    queue.schedule(() => { requests.push(query) })
  }
  t.mock.timers.tick(METADATA_QUERY_DELAY_MS - 1)
  assert.deepEqual(requests, [])
  t.mock.timers.tick(1)
  assert.deepEqual(requests, [input])
  t.mock.timers.tick(METADATA_QUERY_DELAY_MS * 2)
  assert.deepEqual(requests, [input], 'no retry or later duplicate is scheduled')
})

test('closing or leaving the metadata selector cancels the pending query and permits later input', (t) => {
  t.mock.timers.enable()
  const queue = createMetadataValueLoadQueue(), requests: string[] = []
  queue.schedule(() => { requests.push('closed') })
  queue.cancel()
  t.mock.timers.tick(METADATA_QUERY_DELAY_MS)
  assert.deepEqual(requests, [])
  queue.schedule(() => { requests.push('reopened') })
  t.mock.timers.tick(METADATA_QUERY_DELAY_MS)
  assert.deepEqual(requests, ['reopened'])
})

test('background metadata preparation loads definitions before prewarming standard facets', async () => {
  const events: string[] = []

  const result = await prepareAdvancedMetadata({
    metadataDefinitionsLoaded: false,
    metadataDefinitions: [],
    loadMetadataDefinitions: async () => {
      events.push('definitions')
      return [definition('Region'), definition('Source'), definition('Frequency'), definition('Currency'), definition('TitleUnit'), definition('Category')]
    },
    prewarmMetadataValue: async (metadataKey) => {
      events.push(`value:${metadataKey}`)
    },
  })

  assert.deepEqual(result.prewarmKeys, ['Source', 'Frequency', 'Currency', 'TitleUnit', 'Category'])
  assert.deepEqual(result.failedKeys, [])
  assert.equal(events[0], 'definitions')
  assert.deepEqual(events.slice(1).sort(), [
    'value:Category',
    'value:Currency',
    'value:Frequency',
    'value:Source',
    'value:TitleUnit',
  ])
})

test('background metadata preparation reuses already loaded definitions and tolerates partial prewarm failure', async () => {
  let definitionLoads = 0

  const result = await prepareAdvancedMetadata({
    metadataDefinitionsLoaded: true,
    metadataDefinitions: [definition('Source'), definition('Frequency'), definition('Category')],
    loadMetadataDefinitions: async () => {
      definitionLoads += 1
      return []
    },
    prewarmMetadataValue: async (metadataKey) => {
      if (metadataKey === 'Frequency') {
        throw new Error('provider fallback later')
      }
    },
  })

  assert.equal(definitionLoads, 0)
  assert.deepEqual(result.prewarmKeys, ['Source', 'Frequency', 'Category'])
  assert.deepEqual(result.prewarmedKeys.sort(), ['Category', 'Source'])
  assert.deepEqual(result.failedKeys, ['Frequency'])
})

test('Region remote-query behavior remains unchanged and Region is excluded from standard prewarm', () => {
  assert.equal(shouldUseRemoteMetadataQuery('Region'), true)
  assert.equal(shouldUseRemoteMetadataQuery('Source'), false)
  assert.deepEqual(getStandardMetadataPrewarmKeys([definition('Region'), definition('Source'), definition('Currency')]), ['Source', 'Currency'])
})

test('prewarmed ready state is reused and failed prewarm state can retry lazily', () => {
  assert.equal(shouldReuseMetadataValueState({ status: 'ready', query: '', filterSignature: '[]' }, '[]', ''), true)
  assert.equal(shouldReuseMetadataValueState({ status: 'error', query: '', filterSignature: '[]' }, '[]', ''), false)

  const requestKey = buildMetadataValueRequestKey('Source', '[]', '')
  assert.equal(isDuplicateMetadataValueRequest(requestKey, requestKey), true)
  assert.equal(isDuplicateMetadataValueRequest(undefined, requestKey), false)
})

test('selector dictionaries remain unfiltered after criteria selection and stay on the authorized SG Runtime API', () => {
  const selectedCriteria = [{ metadataKey: 'Frequency', operator: 'equals', values: ['daily'] }]
  const before = structuredClone(selectedCriteria)
  for (const metadataKey of ['Source', 'Frequency', 'Currency', 'TitleUnit', 'Category', 'Region']) {
    // An older caller cannot accidentally send peer criteria to the provider's
    // full Region list. The dictionary builder has no criteria parameter.
    const legacyCaller = { metadataKey, filterSignature: JSON.stringify(selectedCriteria),
      remoteFiltering: metadataKey === 'Region', query: 'Pol', limit: 40 }
    const url = new URL(buildMetadataValuesRequestPath(legacyCaller), 'https://example.invalid')
    assert.equal(url.pathname, `/api/benchmark/metadata/${metadataKey}/values`)
    assert.equal(url.searchParams.get('filters'), METADATA_DICTIONARY_FILTER_SIGNATURE)
    assert.equal(url.searchParams.get('q'), metadataKey === 'Region' ? 'Pol' : null)
    assert.equal(url.searchParams.get('limit'), metadataKey === 'Region' ? '40' : null)
    assert.equal(url.origin, 'https://example.invalid')
  }
  assert.deepEqual(selectedCriteria, before, 'criteria remain available for the benchmark SEARCH command')
})

test('ready prewarmed facet count includes only standard ready states', () => {
  assert.equal(countReadyMetadataPrewarmFacets({
    Source: { status: 'ready', query: '', filterSignature: '[]' },
    Frequency: { status: 'ready', query: '', filterSignature: '[]' },
    Region: { status: 'ready', query: '', filterSignature: '[]' },
    Category: { status: 'error', query: '', filterSignature: '[]' },
  }), 2)
})
