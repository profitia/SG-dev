'use client'

import React from 'react'
import { ExecutiveSummary } from '@profitia/srm-xray/executive-summary'
import type { ExecutiveSummaryInput } from '@profitia/srm-xray/executive-summary-rules'
import { financialValue, financialUnits } from '@profitia/srm-xray/financial-value'
import type { FinancialFactEvidence } from '@profitia/srm-xray/contracts'

export type SupplierSummaryDetail = { kind: 'source'; fact: FinancialFactEvidence }
  | { kind: 'indicator'; code: string } | { kind: 'finance' | 'report' } | null
const sourceValue = (fact: FinancialFactEvidence) => Object.hasOwn(financialUnits, fact.unit)
  ? financialValue(fact.amount, fact.unit as keyof typeof financialUnits)
  : `${fact.amount} ${fact.unit} (jednostka źródłowa)`

/** Host presentation around the real shared module; all values and financial
 * qualification remain the existing SRM representation and summary rules. */
export function SupplierSummaryView({ input, detail, onSource, onIndicator, onDetails, onFinance, onClose }: {
  input: ExecutiveSummaryInput; detail: SupplierSummaryDetail
  onSource: (fact: FinancialFactEvidence) => void; onIndicator: (code: string, history?: boolean) => void
  onDetails: () => void; onFinance: () => void; onClose: () => void
}) {
  const metadata = input.metadata?.nip === input.nip && input.metadata.entityType === input.entityType ? input.metadata : null
  const periods = metadata?.financial.periods.filter(period => period.scope === input.scope
    && period.from === input.selectedPeriod?.from && period.to === input.selectedPeriod?.to) ?? []
  const period = periods.length === 1 ? periods[0] : undefined
  const histories = period ? metadata!.financial.history.filter(history => detail?.kind !== 'indicator' || history.code === detail.code) : []
  const source = detail?.kind === 'source' ? period?.facts.find(fact => fact.ref === detail.fact.ref
    && fact.documentRef === detail.fact.documentRef && fact.metricCode === detail.fact.metricCode
    && fact.periodStart === detail.fact.periodStart && fact.periodEnd === detail.fact.periodEnd
    && fact.scope === detail.fact.scope && fact.amount === detail.fact.amount) : undefined
  return <section aria-label="Podsumowanie dostawcy">
    <p className="mb-4 text-sm text-slate-600">Dane dla NIP <strong>{input.nip}</strong> · zapisane dane finansowe MGBI</p>
    <ExecutiveSummary input={input} onSource={onSource} onIndicator={onIndicator} onDetails={onDetails} onFinance={onFinance} />
    {detail && <section aria-label="Dane źródłowe i szczegóły" className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">Dane źródłowe i szczegóły</h2>
        <button type="button" onClick={onClose}>Zamknij szczegóły</button></div>
      {detail.kind === 'source' ? source ? <dl className="grid gap-2">
        <div><dt>Pozycja sprawozdania</dt><dd>{source.metricCode}</dd></div>
        <div><dt>Dokładna wartość</dt><dd>{sourceValue(source)}</dd></div>
        <div><dt>Okres</dt><dd>{source.periodStart} – {source.periodEnd}</dd></div>
        <div><dt>Zakres</dt><dd>{source.scope === 'standalone' ? 'Jednostkowe' : 'Skonsolidowane'}</dd></div>
        <div><dt>Potwierdzenie danych</dt><dd>{source.validation === 'VERIFIED' ? 'Potwierdzone w zapisanych danych' : 'Wymaga sprawdzenia'}</dd></div>
      </dl> : <p>Nie można powiązać tej pozycji z bieżącym wyborem.</p> : detail.kind === 'report' ? <>
        <p className="mb-3">Pozycje z wybranego sprawozdania. Brak wartości nie oznacza zera.</p>
        {period?.facts.length ? <table><thead><tr><th>Pozycja</th><th>Wartość</th><th>Potwierdzenie</th></tr></thead><tbody>
          {period.facts.map(fact => <tr key={fact.ref}><td>{fact.metricCode}</td><td>{sourceValue(fact)}</td>
            <td>{fact.validation === 'VERIFIED' ? 'Potwierdzone' : 'Wymaga sprawdzenia'}</td></tr>)}
        </tbody></table> : <p>Brak pozycji dla wybranego sprawozdania.</p>}
      </> : <>
        <p className="mb-3">Zapisane wskaźniki dla wybranego okresu. Pełne daty i zakres muszą się zgadzać.</p>
        <table><thead><tr><th>Wskaźnik</th><th>Wartość</th><th>Dostępność</th></tr></thead><tbody>
          {histories.flatMap(history => history.points.filter(point => point.scope === input.scope
            && point.periodStart === input.selectedPeriod?.from && point.periodEnd === input.selectedPeriod?.to
            && point.documentRef === period?.documentRef).map(point => <tr key={`${history.code}:${point.documentRef}`}>
              <td>{history.code}</td><td>{point.status === 'AVAILABLE' ? financialValue(point.value, point.unit) : 'Brak potwierdzonej wartości'}</td>
              <td>{point.status === 'AVAILABLE' ? 'Dostępny' : 'Niedostępny dla tego wyboru'}</td>
            </tr>))}
        </tbody></table>
        {!histories.some(history => history.points.some(point => point.scope === input.scope
          && point.periodStart === input.selectedPeriod?.from && point.periodEnd === input.selectedPeriod?.to)) && <p>Brak wskaźników dla tego wyboru.</p>}
      </>}
    </section>}
  </section>
}
