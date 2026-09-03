import assert from 'node:assert/strict'
import test from 'node:test'

import type { BenchmarkMetadataDefinition } from '../lib/benchmark/contracts'
import {
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

test('client facet fetch path stays on SG Runtime API and preserves cross-facet filter signatures', () => {
  const requestPath = buildMetadataValuesRequestPath({
    metadataKey: 'Source',
    filterSignature: '[{"metadataKey":"Currency","operator":"equals","values":["USD"]}]',
    remoteFiltering: false,
    query: '',
    limit: 40,
  })

  assert.match(requestPath, /^\/api\/benchmark\/metadata\/Source\/values\?filters=/)
  assert.ok(!requestPath.includes('macrobond'))
  assert.ok(requestPath.includes(encodeURIComponent('[{"metadataKey":"Currency","operator":"equals","values":["USD"]}]')))
})

test('ready prewarmed facet count includes only standard ready states', () => {
  assert.equal(countReadyMetadataPrewarmFacets({
    Source: { status: 'ready', query: '', filterSignature: '[]' },
    Frequency: { status: 'ready', query: '', filterSignature: '[]' },
    Region: { status: 'ready', query: '', filterSignature: '[]' },
    Category: { status: 'error', query: '', filterSignature: '[]' },
  }), 2)
})