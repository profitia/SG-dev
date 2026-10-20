import type { BenchmarkCandidate, BenchmarkMetadataValue, BenchmarkPreviewResult, SavedBenchmark } from '../../lib/benchmark/contracts'
import { RESULT_PREVIEW_LIMIT, SEARCH_RESULTS_FETCH_LIMIT, nextVisibleResultCount } from '../benchmark-finder/result-window'

export interface PickerState {
  readonly ready: boolean
  readonly searching: boolean
  readonly searched: boolean
  readonly error: 'SESSION_UNAVAILABLE' | 'SEARCH_FAILED' | 'SELECTION_FAILED' | null
  readonly candidates: readonly BenchmarkCandidate[]
  readonly visibleCount: number
  readonly previews: Readonly<Record<string, { status: 'loading' | 'ready' | 'error'; data: BenchmarkPreviewResult | null }>>
  readonly priceTypes: readonly BenchmarkMetadataValue[]
  readonly saved: readonly SavedBenchmark[]
  readonly selecting: string | null
}
export const emptyPickerState = (): PickerState => ({ ready: false, searching: false, searched: false, error: null,
  candidates: [], visibleCount: RESULT_PREVIEW_LIMIT, previews: {}, priceTypes: [], saved: [], selecting: null })
export const benchmarkSeriesKey = (item: BenchmarkCandidate | SavedBenchmark) =>
  `${item.providerSeries.provider.providerCode}:${item.providerSeries.providerSeriesId}`

class RequestFailure extends Error { constructor(readonly status: number) { super('Benchmark operation unavailable') } }

/** Per-mounted-consumer memory only. HTTP operations remain the canonical server owners.
 * Closing, a new search or a replaced session invalidates pending callbacks even if fetch ignores abort.
 * A selection already committed on the server is not rolled back on cancellation.
 */
export function createPickerController(options: {
  request: (path: string, init?: RequestInit) => Promise<Response>
  onSelect: (benchmark: SavedBenchmark) => void
}) {
  let state = emptyPickerState(), closed = false, epoch = 0
  let initialization: Promise<void> | null = null, dictionary: Promise<readonly BenchmarkMetadataValue[]> | null = null
  const listeners = new Set<(state: PickerState) => void>(), controllers = new Set<AbortController>()
  function update(patch: Partial<PickerState>) { if (!closed) { state = { ...state, ...patch }; listeners.forEach(fn => fn(state)) } }
  const current = (version: number) => !closed && version === epoch
  function abort() { for (const c of controllers) c.abort(); controllers.clear() }
  function failure(error: unknown, version: number, code: PickerState['error']) {
    if (!current(version)) return
    if (error instanceof RequestFailure && [401, 403].includes(error.status)) {
      epoch++; abort(); update({ ...emptyPickerState(), error: 'SESSION_UNAVAILABLE' })
    } else update({ error: code })
  }
  async function read<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController(); controllers.add(controller)
    try {
      const response = await options.request(path, { ...init, signal: controller.signal, cache: 'no-store' })
      if (controller.signal.aborted || closed) throw new DOMException('Picker closed', 'AbortError')
      if (!response.ok || response.status === 202) throw new RequestFailure(response.status)
      return await response.json() as T
    } finally { controllers.delete(controller) }
  }
  async function loadVisible(version: number) {
    if (!current(version)) return
    const visible = state.candidates.slice(0, state.visibleCount)
    const previews = visible.filter(c => !state.previews[benchmarkSeriesKey(c)]).map(async candidate => {
      const key = benchmarkSeriesKey(candidate)
      update({ previews: { ...state.previews, [key]: { status: 'loading', data: null } } })
      try {
        const params = new URLSearchParams({ seriesName: candidate.providerSeries.providerSeriesId, range: '1Y' })
        const data = await read<BenchmarkPreviewResult>(`/api/benchmark/preview?${params}`)
        if (data.providerSeries.providerSeriesId !== candidate.providerSeries.providerSeriesId
          || data.providerSeries.provider.providerCode !== candidate.providerSeries.provider.providerCode) throw new RequestFailure(502)
        if (current(version)) update({ previews: { ...state.previews, [key]: { status: 'ready', data } } })
      } catch (error) {
        if (!current(version)) return
        if (error instanceof RequestFailure && [401, 403].includes(error.status)) failure(error, version, 'SESSION_UNAVAILABLE')
        else update({ previews: { ...state.previews, [key]: { status: 'error', data: null } } })
      }
    })
    // Only if visible metadata actually contains price-type codes. One existing dictionary read per
    // consumer session; no per-row enrichment, semantic-context request or hidden-row prefetch.
    if (visible.some(c => c.metadata?.PriceType) && !dictionary) {
      dictionary = read<{ items: BenchmarkMetadataValue[] }>('/api/benchmark/metadata/PriceType/values?limit=200').then(v => v.items)
      dictionary = dictionary.catch(error => { failure(error, version, null); return [] })
    }
    const metadata = dictionary?.then(priceTypes => { if (current(version)) update({ priceTypes }) })
    await Promise.all([...previews, metadata])
  }
  function initialize() {
    if (initialization) return initialization
    const version = epoch
    initialization = (async () => {
      try { const payload = await read<{ items: SavedBenchmark[] }>('/api/benchmark/selection'); if (current(version)) update({ ready: true, saved: payload.items }) }
      catch (error) { failure(error, version, 'SESSION_UNAVAILABLE') }
    })()
    return initialization
  }
  async function search(query: string) {
    if (!state.ready || closed) return
    const version = ++epoch; abort()
    dictionary = state.priceTypes.length ? Promise.resolve(state.priceTypes) : null
    update({ candidates: [], previews: {}, visibleCount: RESULT_PREVIEW_LIMIT, searching: !!query.trim(), searched: false, selecting: null, error: null })
    if (!query.trim()) return
    try {
      const params = new URLSearchParams({ q: query.trim(), limit: String(SEARCH_RESULTS_FETCH_LIMIT) })
      const payload = await read<{ items: BenchmarkCandidate[] }>(`/api/benchmark/search?${params}`)
      if (!current(version)) return
      update({ candidates: payload.items, searching: false, searched: true })
      await loadVisible(version)
    } catch (error) { if (current(version)) { update({ searching: false }); failure(error, version, 'SEARCH_FAILED') } }
  }
  async function showMore() {
    if (!state.ready || closed || state.searching) return
    update({ visibleCount: nextVisibleResultCount(state.visibleCount, state.candidates.length) })
    await loadVisible(epoch)
  }
  async function select(candidate: BenchmarkCandidate) {
    if (closed || !state.ready || state.selecting || !state.candidates.slice(0, state.visibleCount).includes(candidate)) return
    const version = epoch, key = benchmarkSeriesKey(candidate)
    update({ selecting: key, error: null })
    try {
      const existing = state.saved.find(item => benchmarkSeriesKey(item) === key)
      const selected = existing ?? await read<SavedBenchmark>('/api/benchmark/selection', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate }),
      })
      if (!current(version)) return
      if (benchmarkSeriesKey(selected) !== key || !selected.businessBenchmarkId || !selected.selectionId) throw new RequestFailure(502)
      update({ saved: [selected, ...state.saved.filter(item => benchmarkSeriesKey(item) !== key)], selecting: null })
      options.onSelect(selected)
    } catch (error) { if (current(version)) { update({ selecting: null }); failure(error, version, 'SELECTION_FAILED') } }
  }
  return { initialize, search, showMore, select, getSnapshot: () => state,
    subscribe(listener: (state: PickerState) => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    close() { epoch++; abort(); state = emptyPickerState(); closed = true; listeners.clear() } }
}
