'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/react'
import { useSg2IdentityMode } from '../auth/session-boundary'
import { createBenchmarkRequester } from '../benchmark-finder/benchmark-request'
import { benchmarkSeriesKey, createPickerController, emptyPickerState, type PickerState } from './picker-controller'
import { benchmarkPriceType, pickerNumber, pickerObservationDate } from './presentation'
import { formatDisplayMeasurement, sanitizeUserFacingPublisher } from '../../lib/benchmark/presentation'
import type { BenchmarkCandidate, SavedBenchmark } from '../../lib/benchmark/contracts'

/** Mount/key a fresh Picker for a different consumer context. It owns no category or model action. */
export interface SharedBenchmarkPickerProps {
  locale: 'pl' | 'en'
  initialQuery?: string
  /** Existing businessBenchmarkId, resolved only against the current authorized saved selections. */
  initialSelectedBenchmarkId?: string | null
  onSelect: (benchmark: SavedBenchmark) => void
  onCancel?: () => void
  disabled?: boolean
}

const copy = {
  pl: { search: 'Szukaj benchmarku', placeholder: 'np. miedź', submit: 'Szukaj', name: 'Benchmark', type: 'Typ', frequency: 'Kadencja',
    last: 'Ostatnia wartość', select: 'Wybierz', use: 'Użyj wybranego', cancel: 'Anuluj', more: 'Pokaż kolejne 5',
    loading: 'Ładowanie…', empty: 'Brak wyników.', start: 'Wpisz nazwę lub identyfikator benchmarku.', current: 'Obecny benchmark',
    unavailable: 'Wybór benchmarku jest chwilowo niedostępny. Sprawdź sesję i uprawnienia.', searchError: 'Nie udało się wyszukać benchmarków.',
    selectionError: 'Nie udało się wybrać benchmarku.', previewError: 'Podgląd niedostępny', disabled: 'Wybór benchmarku jest wyłączony.', date: 'Data obserwacji' },
  en: { search: 'Search benchmarks', placeholder: 'e.g. copper', submit: 'Search', name: 'Benchmark', type: 'Type', frequency: 'Frequency',
    last: 'Last', select: 'Select', use: 'Use selected', cancel: 'Cancel', more: 'Show next 5',
    loading: 'Loading…', empty: 'No results.', start: 'Enter a benchmark name or identifier.', current: 'Current benchmark',
    unavailable: 'Benchmark selection is temporarily unavailable. Check your session and permissions.', searchError: 'Benchmark search failed.',
    selectionError: 'Benchmark selection failed.', previewError: 'Preview unavailable', disabled: 'Benchmark selection is disabled.', date: 'Observation date' },
} as const
const button = 'rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-50'

/** Shared presentational surface; no forecasts, iframes, category identifiers or metric calculation. */
export function BenchmarkPickerView({ locale, state, query, setQuery, search, more, select, cancel, initialSelectedBenchmarkId, disabled = false }: {
  locale: 'pl' | 'en'; state: PickerState; query: string; setQuery: (query: string) => void; search: () => void
  more: () => void; select: (candidate: BenchmarkCandidate) => void; cancel?: () => void
  initialSelectedBenchmarkId?: string | null; disabled?: boolean
}) {
  const t = copy[locale], visible = state.candidates.slice(0, state.visibleCount)
  const selected = state.saved.find(item => item.businessBenchmarkId === initialSelectedBenchmarkId)
  const error = state.error === 'SESSION_UNAVAILABLE' ? t.unavailable : state.error === 'SELECTION_FAILED' ? t.selectionError : state.error === 'SEARCH_FAILED' ? t.searchError : null
  return <section className="space-y-4 p-4 text-slate-900 sm:p-6" aria-label={t.search} onKeyDown={event => {
    if (event.key === 'Escape' && cancel) { event.preventDefault(); event.stopPropagation(); cancel() }
  }}>
    <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); search() }}>
      <label className="min-w-48 flex-1 text-sm font-medium">{t.search}
        <input autoFocus type="search" maxLength={500} value={query} placeholder={t.placeholder} disabled={disabled || !state.ready}
          onChange={event => setQuery(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
      </label>
      <button type="submit" className={button + ' self-end'} disabled={disabled || !state.ready || !query.trim()}>{t.submit}</button>
      {cancel ? <button type="button" className={button + ' self-end'} onClick={cancel}>{t.cancel}</button> : null}
    </form>
    {selected ? <p className="rounded-xl bg-teal-50 p-3 text-sm">{t.current}: <strong>{selected.displayName}</strong></p> : null}
    {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
    <p role="status" aria-live="polite" className="text-sm text-slate-500">{disabled ? t.disabled : state.searching || !state.ready && !error ? t.loading
      : state.searched && !visible.length ? t.empty : !state.searched && !error ? t.start : null}</p>
    {visible.length ? <table className="block w-full text-left text-sm md:table" aria-label={t.search}>
      <thead className="hidden border-b border-slate-200 text-xs text-slate-500 md:table-header-group"><tr>
        {[t.name, t.type, t.frequency, t.last, '1M', '3M', '1Y', t.select].map(label => <th key={label} scope="col" className="px-2 py-3">{label}</th>)}
      </tr></thead>
      <tbody className="block md:table-row-group">{visible.map(candidate => {
        const key = benchmarkSeriesKey(candidate), previewState = state.previews[key], preview = previewState?.data
        const isSelected = candidate.providerSeries.providerSeriesId === selected?.providerSeries.providerSeriesId
        const measurement = formatDisplayMeasurement(preview?.currency ?? candidate.currency, preview?.unit ?? candidate.unit)
        const source = sanitizeUserFacingPublisher(preview?.source ?? candidate.source)
        const date = pickerObservationDate(candidate.lastObservationDate, locale)
        const cell = 'block px-2 py-2 align-top md:table-cell'
        return <tr key={key} className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-slate-200 p-2 md:table-row md:border-0 md:border-b md:p-0">
          <th scope="row" className={cell + ' col-span-2 max-w-sm font-medium'}>{candidate.displayName}
            <span className="mt-1 block text-xs font-normal text-slate-500">{[source, candidate.region].filter(Boolean).join(' · ')}</span>
            {date ? <span className="block text-xs font-normal text-slate-500">{t.date}: {date}</span> : null}
          </th>
          <td className={cell}><span className="block text-xs text-slate-500 md:hidden">{t.type}</span>{benchmarkPriceType(candidate, state.priceTypes, locale)}</td>
          <td className={cell}><span className="block text-xs text-slate-500 md:hidden">{t.frequency}</span>{preview?.frequency ?? candidate.frequency ?? '—'}</td>
          <td className={cell}><span className="block text-xs text-slate-500 md:hidden">{t.last}</span>{pickerNumber(preview?.latestValue, locale)}
            <span className="block text-xs text-slate-500">{measurement}</span>
            {previewState?.status === 'loading' ? <span role="status" className="block text-xs text-slate-500">{t.loading}</span> : null}
            {previewState?.status === 'error' ? <span className="block text-xs text-slate-500">{t.previewError}</span> : null}
          </td>
          {(['1M', '3M', '1Y'] as const).map(metric => <td key={metric} className={cell + ' tabular-nums'}><span className="block text-xs text-slate-500 md:hidden">{metric}</span>{pickerNumber(preview?.changeMetrics[metric], locale, true)}</td>)}
          <td className={cell}><button type="button" className={button} disabled={disabled || !state.ready || state.selecting !== null}
            aria-label={`${isSelected ? t.use : t.select}: ${candidate.displayName}`} onClick={() => select(candidate)}>
            {state.selecting === key ? t.loading : isSelected ? t.use : t.select}
          </button></td>
        </tr>
      })}</tbody>
    </table> : null}
    {visible.length < state.candidates.length ? <button type="button" className={button} onClick={more} disabled={disabled || state.searching || !state.ready}>{t.more}</button> : null}
  </section>
}

function PickerSession(props: SharedBenchmarkPickerProps & { mode: 'clerk' | 'legacy_demo'; getToken: () => Promise<string | null> }) {
  const [state, setState] = useState(emptyPickerState), [query, setQuery] = useState(props.initialQuery ?? '')
  const live = useRef(props); live.current = props
  const controller = useRef<ReturnType<typeof createPickerController> | null>(null)
  const stop = useRef<(() => void) | null>(null)
  // Invalidate the old context during unmount commit, before any deferred reply can publish.
  useLayoutEffect(() => () => { stop.current?.() }, [])
  useEffect(() => {
    const request = createBenchmarkRequester({ mode: () => live.current.mode, getToken: () => live.current.getToken(),
      origin: () => window.location.origin, fetch: (...args) => globalThis.fetch(...args), newKey: () => 'finder_' + crypto.randomUUID() }, 'picker')
    const current = createPickerController({ request, onSelect: value => live.current.onSelect(value) })
    controller.current = current; setState(current.getSnapshot())
    const unsubscribe = current.subscribe(setState)
    const close = () => { current.close(); request.close(); unsubscribe() }; stop.current = close
    void current.initialize().then(() => { if (live.current.initialQuery?.trim()) void current.search(live.current.initialQuery) })
    return () => { close(); if (controller.current === current) controller.current = null }
  }, [])
  return <BenchmarkPickerView {...props} state={state} query={query} setQuery={setQuery}
    search={() => { void controller.current?.search(query) }} more={() => { void controller.current?.showMore() }}
    select={candidate => { void controller.current?.select(candidate) }} cancel={props.onCancel ? () => { stop.current?.(); props.onCancel?.() } : undefined} />
}

function UnavailablePicker(props: SharedBenchmarkPickerProps) {
  return <div className="space-y-3 p-6"><p role="alert">{copy[props.locale].unavailable}</p>
    {props.onCancel ? <button type="button" className={button} onClick={props.onCancel}>{copy[props.locale].cancel}</button> : null}</div>
}

function ClerkPicker(props: SharedBenchmarkPickerProps) {
  const { isLoaded, isSignedIn, userId, sessionId, orgId, getToken } = useAuth()
  if (!isLoaded || !isSignedIn || !userId || !sessionId) return <UnavailablePicker {...props} />
  // SDK IDs only invalidate UI memory; backend remains the sole organization/permission authority.
  return <PickerSession key={JSON.stringify([userId, sessionId, orgId, props.initialQuery, props.initialSelectedBenchmarkId])} {...props} mode="clerk" getToken={getToken} />
}

export function SharedBenchmarkPicker(props: SharedBenchmarkPickerProps) {
  const mode = useSg2IdentityMode()
  if (props.disabled) return <BenchmarkPickerView {...props} state={emptyPickerState()} query={props.initialQuery ?? ''} setQuery={() => {}} search={() => {}} more={() => {}} select={() => {}} cancel={props.onCancel} />
  if (mode === 'clerk') return <ClerkPicker {...props} />
  if (mode === 'legacy_demo') return <PickerSession key={JSON.stringify([props.initialQuery, props.initialSelectedBenchmarkId])} {...props} mode="legacy_demo" getToken={async () => null} />
  return <UnavailablePicker {...props} />
}
