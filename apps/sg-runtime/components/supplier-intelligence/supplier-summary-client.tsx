'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/react'
import type { FinancialPeriod, SupplierReportData } from '@profitia/srm-xray/contracts'
import { readSharedFinancialSummary } from '@profitia/srm-xray/shared-financial-summary'
import { SupplierSummaryView, type SupplierSummaryDetail } from './supplier-summary-view'
import styles from './supplier-summary.module.css'

type Period = { from: string; to: string; scope: FinancialPeriod['scope'] }
const periodKey = (period: Period) => JSON.stringify([period.from, period.to, period.scope])

export function SupplierSummaryClient({ locale }: { locale: 'pl' | 'en' }) {
  const { getToken } = useAuth()
  const [nip, setNip] = useState(''), [activeNip, setActiveNip] = useState('')
  const [report, setReport] = useState<SupplierReportData | null>(null)
  const [period, setPeriod] = useState<Period | null>(null), [detail, setDetail] = useState<SupplierSummaryDetail>(null)
  const [loading, setLoading] = useState(false), [error, setError] = useState('')
  const request = useRef<{ id: number; controller: AbortController } | null>(null), serial = useRef(0)
  useEffect(() => () => { serial.current++; request.current?.controller.abort() }, [])
  function clear() {
    serial.current++; request.current?.controller.abort(); request.current = null
    setReport(null); setPeriod(null); setDetail(null); setActiveNip(''); setError(''); setLoading(false)
  }
  async function load(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); clear()
    if (!/^\d{10}$/.test(nip)) { setError('Podaj dziesięciocyfrowy numer NIP.'); return }
    const selectedNip = nip, id = ++serial.current, controller = new AbortController()
    request.current = { id, controller }; setActiveNip(selectedNip); setLoading(true)
    let status = 0
    try {
      const bearer = await getToken()
      if (id !== serial.current || controller.signal.aborted) return
      if (!bearer) { status = 401; throw new Error('Session unavailable') }
      const response = await fetch(`/api/supplier/financial-summary?nip=${encodeURIComponent(selectedNip)}&entityType=COMPANY`, {
        headers: { Authorization: `Bearer ${bearer}` }, credentials: 'omit', cache: 'no-store', signal: controller.signal,
      })
      status = response.status
      if (!response.ok) throw new Error('Read unavailable')
      const value = readSharedFinancialSummary(await response.json(), { nip: selectedNip, entityType: 'COMPANY' })
      if (id !== serial.current || controller.signal.aborted) return
      setReport(value)
      const first = value.financial.periods[0]
      setPeriod(first ? { from: first.from, to: first.to, scope: first.scope } : null)
    } catch {
      if (id !== serial.current || controller.signal.aborted) return
      setReport(null); setPeriod(null); setDetail(null)
      setError(status === 401 ? 'Sesja jest niedostępna. Zaloguj się ponownie.'
        : status === 403 ? 'Nie masz dostępu do tego raportu.' : 'Nie można teraz potwierdzić zapisanych danych. Spróbuj ponownie później.')
    } finally { if (id === serial.current) { request.current = null; setLoading(false) } }
  }
  const periods = Array.from(new Map(report?.financial.periods.map(period => [periodKey(period), period]) ?? []).values())
  return <div className={styles.root}>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div>
      <h1 className="text-2xl font-semibold text-slate-900">Supplier Intelligence</h1>
      <p className="mt-2 text-sm text-slate-600">Podsumowanie zapisanych danych finansowych dostawcy. Ten odczyt nie odświeża danych.</p>
    </div><a href={`/${locale}/benchmark-finder`}>{locale === 'en' ? 'Back to SpendGuru' : 'Wróć do SpendGuru'}</a></div>
    <form onSubmit={load} className="mb-6 flex flex-wrap items-end gap-3">
      <label className="grid gap-2 text-sm font-medium">NIP spółki
        <input name="nip" aria-label="NIP spółki" inputMode="numeric" autoComplete="off" pattern="[0-9]{10}" maxLength={10} required value={nip}
          onChange={event => { clear(); setNip(event.target.value) }} className="rounded-lg border border-slate-300 px-3 py-2" />
      </label><button type="submit" disabled={loading} className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{loading ? 'Odczyt danych…' : 'Pokaż podsumowanie'}</button>
    </form>
    {loading && <p role="status">Odczyt zapisanych danych…</p>}
    {error && <p role="alert" className="mb-5 text-red-700">{error}</p>}
    {report && <>
      {periods.length > 0 && <label className="mb-5 grid max-w-lg gap-2 text-sm font-medium">Sprawozdanie
        <select aria-label="Sprawozdanie" value={period ? periodKey(period) : ''} onChange={event => {
          const chosen = periods.find(period => periodKey(period) === event.target.value)
          setPeriod(chosen ? { from: chosen.from, to: chosen.to, scope: chosen.scope } : null); setDetail(null)
        }} className="rounded-lg border border-slate-300 px-3 py-2">
          {periods.map(period => <option key={periodKey(period)} value={periodKey(period)}>{period.from} – {period.to} · {period.scope === 'standalone' ? 'Jednostkowe' : 'Skonsolidowane'}</option>)}
        </select>
      </label>}
      <SupplierSummaryView input={{ nip: activeNip, entityType: 'COMPANY', metadata: report, selectedPeriod: period ? { from: period.from, to: period.to } : null,
        scope: period?.scope ?? null, kysStatus: 'NOT_REQUESTED', kysHasData: false }} detail={detail}
        onSource={fact => setDetail({ kind: 'source', fact })} onIndicator={code => setDetail({ kind: 'indicator', code })}
        onDetails={() => setDetail({ kind: 'report' })} onFinance={() => setDetail({ kind: 'finance' })} onClose={() => setDetail(null)} />
    </>}
  </div>
}
