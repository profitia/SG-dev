"use client";

import React, { useId, useState } from "react";
import type { FinancialFactEvidence, FinancialHistoryPoint, SupplierReportData } from "./contracts";
import type { FinancialPeriodSelection } from "./financial-dashboard";
import { healthGroups, importanceLabels, indicatorContent, indicatorPresentation, type HealthArea } from "./financial-indicator-content";
import { financialValue, hasHistoryValue, historyPoints, isSelected } from "./financial-history";
import { compactFinancialValue } from "./financial-value";
import { FinancialIndicatorDialog, type IndicatorView } from "./financial-indicator-dialog";
export type FinancialSourceAction = (fact: FinancialFactEvidence) => void;
const explanations: Record<string, string> = {
  CURRENT_RATIO: "Relacja aktywów obrotowych do zobowiązań krótkoterminowych.",
  QUICK_RATIO: "Relacja aktywów obrotowych bez zapasów do zobowiązań krótkoterminowych.",
  NET_WORKING_CAPITAL: "Różnica między aktywami obrotowymi a zobowiązaniami krótkoterminowymi.",
  CASH_CONVERSION_CYCLE: "Czas od wydatku na zapasy do odzyskania gotówki ze sprzedaży.",
  LIABILITIES_TO_ASSETS: "Jaka część aktywów odpowiada zobowiązaniom i rezerwom.",
  EQUITY_TO_ASSETS: "Jaka część aktywów jest finansowana kapitałem własnym.",
  INTEREST_COVERAGE: "Relacja wyniku operacyjnego do kosztów odsetek.",
  NET_DEBT_TO_EBITDA: "Relacja długu netto do EBITDA.",
  OPERATING_MARGIN: "Udział wyniku operacyjnego w przychodach.",
  NET_MARGIN: "Udział wyniku netto w przychodach.",
  EBITDA_MARGIN: "Udział EBITDA w przychodach.",
  ROA: "Relacja wyniku netto do średnich aktywów.",
  ROE: "Relacja wyniku netto do średniego kapitału własnego.",
  REVENUE_YOY: "Zmiana przychodów względem poprzedniego okresu według zapisanej kalkulacji.",
  MATERIALS_ENERGY_SHARE: "Udział zużycia materiałów i energii w kosztach działalności operacyjnej.",
  FREE_CASH_FLOW: "Przepływy operacyjne pomniejszone o nakłady inwestycyjne."
};
function FinancialHealthCard({ code, points, selectedPeriod, loading, onSource }: {
  code: string; points: FinancialHistoryPoint[]; selectedPeriod: FinancialPeriodSelection | null;
  loading: boolean; onSource?: FinancialSourceAction;
}) {
  const [view, setView] = useState<IndicatorView | null>(null), id = useId();
  const point = points.find(item => isSelected(item, selectedPeriod)), available = point ? hasHistoryValue(point) : false;
  const unit = point?.unit ?? indicatorPresentation[code].unit, importance = point?.importance ?? indicatorPresentation[code].importance;
  const count = points.filter(hasHistoryValue).length;
  return <article id={`${id}-card`} data-financial-indicator={code} className="health-card" aria-labelledby={`${id}-title`}>
    <header><h4 id={`${id}-title`} tabIndex={-1}>{indicatorContent[code].name}</h4></header>
    <p className={`health-card-value ${available ? "" : "health-card-value--missing"}`} title={available ? financialValue(point!.value, unit) : undefined}>{available ? compactFinancialValue(point!.value, unit) : loading ? "Odczytywanie…" : "Brak danych"}</p>
    <p className="health-description">{explanations[code]}</p>
    <div className="health-card-meta"><span className="health-importance" title="Istotność wskaźnika dla kupca, nie ocena wyniku dostawcy">{importanceLabels[importance]}</span><span>{count} {count === 1 ? "okres w historii" : "okresów w historii"}</span></div>
    <div className="health-card-actions"><button type="button" data-financial-view="history" aria-haspopup="dialog" onClick={event => { event.currentTarget.focus({ preventScroll: true }); setView("history"); }}>Zobacz historię</button>
      <button type="button" data-financial-view="methodology" aria-haspopup="dialog" onClick={event => { event.currentTarget.focus({ preventScroll: true }); setView("methodology"); }}>Jak to obliczamy?</button></div>
    {view && <FinancialIndicatorDialog code={code} points={points} selectedPeriod={selectedPeriod} initialView={view} onClose={() => setView(null)} onSource={onSource} />}
  </article>;
}
export function FinancialHealthArea({ area, financial, scope, selectedPeriod, loading = false, onSource }: {
  area: HealthArea; financial: SupplierReportData["financial"] | null; scope: FinancialHistoryPoint["scope"] | null;
  selectedPeriod: FinancialPeriodSelection | null; loading?: boolean; onSource?: FinancialSourceAction;
}) {
  return <div className="health-card-grid">{healthGroups[area].map(code => <FinancialHealthCard key={`${scope}:${code}`} code={code}
    points={historyPoints(financial?.history.find(item => item.code === code)?.points ?? [], code, scope)} selectedPeriod={selectedPeriod} loading={loading} onSource={onSource} />)}</div>;
}
