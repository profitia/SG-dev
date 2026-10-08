"use client";

import React, { useId, useState, type ReactNode } from "react";
import type { FinancialFactEvidence, FinancialHistoryPoint, SupplierReportData } from "./contracts";
import type { FinancialPeriodSelection } from "./financial-dashboard";
import { financialLabels } from "./financial-labels";
import { healthGroups, importanceLabels, indicatorContent, indicatorPresentation, financialReason, type HealthArea } from "./financial-indicator-content";
import { FinancialHistory, comparisonText, financialUnits, financialValue, hasHistoryValue, historyPoints, isSelected } from "./financial-history";
export type FinancialSourceAction = (fact: FinancialFactEvidence) => void;
function FinancialHealthCard({ code, points, selectedPeriod, loading, onSource, interpretation }: {
  code: string; points: FinancialHistoryPoint[]; selectedPeriod: FinancialPeriodSelection | null;
  loading: boolean; onSource?: FinancialSourceAction; interpretation?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false), id = useId();
  const content = indicatorContent[code], point = points.find(item => isSelected(item, selectedPeriod));
  const available = point ? hasHistoryValue(point) : false;
  const unit = point?.unit ?? indicatorPresentation[code].unit;
  const importance = point?.importance ?? indicatorPresentation[code].importance;
  const count = points.filter(hasHistoryValue).length;
  return <article className="health-card" aria-labelledby={`${id}-title`}>
    <header><h4 id={`${id}-title`}>{content.name}</h4><span className="health-importance" title="Istotność wskaźnika dla kupca, nie ocena wyniku dostawcy">{importanceLabels[importance]}</span></header>
    <p className={`health-card-value ${available ? "" : "health-card-value--missing"}`}>{available ? financialValue(point!.value, unit) : loading ? "Odczytywanie wyników…" : "Niedostępny"}</p>
    <p className="health-card-period">{selectedPeriod ? `${selectedPeriod.from} – ${selectedPeriod.to}` : "Okres nieustalony"}<span>Jednostka: {financialUnits[unit]}</span></p>
    {!available && !loading && <p className="health-data-note">{point ? financialReason(point.reasonCode) : selectedPeriod ? "Brak zapisanego wyniku dla wybranego okresu i zakresu." : "Brak zapisanego okresu finansowego."}</p>}
    <p className="health-description">{content.description}</p>
    {point?.comparison.status === "COMPARABLE" && <p className="health-change">{comparisonText(point)}</p>}
    <p className="health-muted">Historia: {count} {count === 1 ? "dostępny okres" : "dostępnych okresów"}</p>
    <div className="health-card-actions"><button type="button" aria-expanded={expanded} aria-controls={`${id}-history`} onClick={() => setExpanded(!expanded)}>{expanded ? "Ukryj historię" : "Pokaż historię"}</button></div>
    {expanded && <div id={`${id}-history`}><FinancialHistory name={content.name} points={points} selectedPeriod={selectedPeriod} /></div>}
    <details className="health-methodology"><summary>Jak to obliczamy?</summary><div>
      <h5>{content.name}</h5><p>{content.description}</p><p><strong>Wzór:</strong> {content.formula}</p>
      {content.requirement && <p>{content.requirement}</p>}
      <dl><dt>Jednostka</dt><dd>{financialUnits[unit]}</dd><dt>Wersja metodologii</dt><dd>{point?.formulaVersion || "nie ustalono"}</dd>
        <dt>Okres</dt><dd>{selectedPeriod ? `${selectedPeriod.from} – ${selectedPeriod.to}` : "nie ustalono"}</dd><dt>Zakres</dt><dd>{point ? point.scope === "standalone" ? "Jednostkowy" : "Skonsolidowany" : "nie ustalono"}</dd>
        <dt>Status wyniku</dt><dd>{available ? "Dostępny — zapisany wynik backendu" : "Niedostępny"}</dd></dl>
      {!available && <p>{financialReason(point?.reasonCode)}</p>}
      <h5>Podstawa obliczenia</h5>
      {point?.evidence.length ? <ul className="health-evidence">{point.evidence.map(fact => <li key={fact.ref}>
        <strong>{financialLabels[fact.metricCode]?.label ?? "Pozycja finansowa ze sprawozdania"}</strong>
        <span>{fact.periodStart} – {fact.periodEnd} · {fact.scope === "standalone" ? "jednostkowe" : "skonsolidowane"}</span>
        <span>Wartość użyta: {fact.currency === "PLN" && fact.unit === "PLN" ? financialValue(fact.amount, "PLN") : `${fact.amount} ${fact.unit} · ${fact.currency}`}</span>
        <span>{fact.validation === "VERIFIED" ? "Zweryfikowana" : fact.validation === "UNVERIFIED" ? "Niezweryfikowana" : "Niedostępna"} · {fact.normalization === "NORMALIZED_CONFIRMED" ? "Normalizacja potwierdzona" : fact.normalization === "SOURCE_VALUE" ? "Wartość źródłowa" : "Normalizacja niepotwierdzona"}</span>
        {fact.sourceAmount !== null && fact.sourceAmount !== fact.amount && <span>Wartość źródłowa: {fact.sourceAmount} {fact.unit} · {fact.currency}</span>}
        {fact.reasonCode && <span>{financialReason(fact.reasonCode)}</span>}
        {onSource && <button type="button" onClick={() => onSource(fact)}>Przejdź do sprawozdania</button>}
      </li>)}</ul> : <p>Brak potwierdzonych pozycji źródłowych dostępnych dla tego wyniku.</p>}
      <p className="health-muted">Nie wszystkie szczegółowe pozycje są osobnymi wierszami w tabelach. Ich dostępne wartości źródłowe pokazujemy powyżej.</p>
      <p className="health-muted">Wyniki i walidacja pochodzą z backendu SRM. Nie zmieniamy znaków ani nie obliczamy wskaźników w przeglądarce.</p>
      {interpretation && <div>{interpretation}</div>}
    </div></details>
  </article>;
}
export function FinancialHealthArea({ area, financial, scope, selectedPeriod, loading = false, onSource }: {
  area: HealthArea; financial: SupplierReportData["financial"] | null; scope: FinancialHistoryPoint["scope"] | null;
  selectedPeriod: FinancialPeriodSelection | null; loading?: boolean; onSource?: FinancialSourceAction;
}) {
  return <div className="health-card-grid">{healthGroups[area].map(code => <FinancialHealthCard key={`${scope}:${code}`} code={code}
    points={historyPoints(financial?.history.find(item => item.code === code)?.points ?? [], code, scope)} selectedPeriod={selectedPeriod} loading={loading} onSource={onSource} />)}</div>;
}
