import type { BenchmarkMetadataDefinition } from '@/lib/benchmark/contracts'

type MetadataValueStateLike = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  query: string
  filterSignature: string
}

type PrepareAdvancedMetadataParams = {
  metadataDefinitionsLoaded: boolean
  metadataDefinitions: Pick<BenchmarkMetadataDefinition, 'key'>[]
  loadMetadataDefinitions: () => Promise<BenchmarkMetadataDefinition[]>
  prewarmMetadataValue: (metadataKey: string) => Promise<void>
}

export const STANDARD_METADATA_PREWARM_KEYS = ['Source', 'Frequency', 'Currency', 'TitleUnit', 'Category'] as const
export const REMOTE_METADATA_QUERY_KEYS = new Set(['Region'])

export function shouldUseRemoteMetadataQuery(metadataKey: string) {
  return REMOTE_METADATA_QUERY_KEYS.has(metadataKey)
}

export function getStandardMetadataPrewarmKeys(definitions: Pick<BenchmarkMetadataDefinition, 'key'>[]) {
  const availableKeys = new Set(definitions.map((definition) => definition.key))
  return STANDARD_METADATA_PREWARM_KEYS.filter((metadataKey) => availableKeys.has(metadataKey) && !shouldUseRemoteMetadataQuery(metadataKey))
}

export function buildMetadataValueRequestKey(metadataKey: string, filterSignature: string, query: string) {
  return JSON.stringify({ metadataKey, filterSignature, query })
}

export function shouldReuseMetadataValueState(
  state: MetadataValueStateLike | undefined,
  filterSignature: string,
  query: string,
) {
  return state?.status === 'ready'
    && state.filterSignature === filterSignature
    && state.query === query
}

export function isDuplicateMetadataValueRequest(activeRequestKey: string | undefined, requestKey: string) {
  return activeRequestKey === requestKey
}

export function buildMetadataValuesRequestPath(params: {
  metadataKey: string
  filterSignature: string
  remoteFiltering: boolean
  query: string
  limit: number
}) {
  const searchParams = new URLSearchParams({ filters: params.filterSignature })
  if (params.remoteFiltering) {
    searchParams.set('q', params.query)
    searchParams.set('limit', String(params.limit))
  }

  return `/api/benchmark/metadata/${encodeURIComponent(params.metadataKey)}/values?${searchParams.toString()}`
}

export async function prepareAdvancedMetadata(params: PrepareAdvancedMetadataParams) {
  const definitions = params.metadataDefinitionsLoaded
    ? params.metadataDefinitions
    : await params.loadMetadataDefinitions()
  const prewarmKeys = getStandardMetadataPrewarmKeys(definitions)
  const results = await Promise.allSettled(prewarmKeys.map((metadataKey) => params.prewarmMetadataValue(metadataKey)))

  return {
    prewarmKeys,
    prewarmedKeys: prewarmKeys.filter((metadataKey, index) => results[index]?.status === 'fulfilled'),
    failedKeys: prewarmKeys.filter((metadataKey, index) => results[index]?.status === 'rejected'),
  }
}

export function countReadyMetadataPrewarmFacets(
  metadataValuesByKey: Record<string, MetadataValueStateLike>,
  metadataKeys = STANDARD_METADATA_PREWARM_KEYS,
) {
  return metadataKeys.filter((metadataKey) => metadataValuesByKey[metadataKey]?.status === 'ready').length
}