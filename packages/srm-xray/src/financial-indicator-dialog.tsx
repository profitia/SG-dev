"use client";

import React, { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { FinancialFactEvidence, FinancialHistoryPoint } from "./contracts";
import type { FinancialPeriodSelection } from "./financial-dashboard";
import { financialLabels } from "./financial-labels";
import { indicatorContent, indicatorPresentation, financialReason } from "./financial-indicator-content";
import { FinancialHistory, financialUnits, financialValue, hasHistoryValue } from "./financial-history";
export type IndicatorView = "history" | "methodology";
export function FinancialIndicatorMethodology({ code, point, selectedPeriod, onSource, interpretation }: {
  code: string; point?: FinancialHistoryPoint; selectedPeriod: FinancialPeriodSelection | null;
  onSource?: (fact: FinancialFactEvidence) => void; interpretation?: ReactNode;
}) {
  const content = indicatorContent[code], unit = point?.unit ?? indicatorPresentation[code].unit;
  const available = point ? hasHistoryValue(point) : false;
  return <div className="health-methodology">

      <h5>{content.name}</h5><p>{content.description}</p><p><strong>Wzór:</strong> {content.formula}</p>
      {content.requirement && <p>{content.requirement}</p>}
      <dl><dt>Dokładny wynik</dt><dd>{available ? financialValue(point!.value, unit) : "Brak danych"}</dd><dt>Jednostka</dt><dd>{financialUnits[unit]}</dd><dt>Wersja metodologii</dt><dd>{point?.formulaVersion || "nie ustalono"}</dd>
        <dt>Okres</dt><dd>{selectedPeriod ? `${selectedPeriod.from} – ${selectedPeriod.to}` : "nie ustalono"}</dd><dt>Zakres</dt><dd>{point ? point.scope === "standalone" ? "Jednostkowy" : "Skonsolidowany" : "nie ustalono"}</dd>
        <dt>Status wyniku</dt><dd>{available ? "Dostępny — zapisany wynik backendu" : "Niedostępny"}</dd></dl>
      {!available && <p>{point ? financialReason(point.reasonCode) : selectedPeriod ? "Brak zapisanego wyniku dla wybranego okresu i zakresu." : "Brak zapisanego okresu finansowego."}</p>}
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
    
  </div>;
}
export function FinancialIndicatorDialog({ code, points, selectedPeriod, initialView, onClose, onSource }: {
  code: string; points: FinancialHistoryPoint[]; selectedPeriod: FinancialPeriodSelection | null;
  initialView: IndicatorView; onClose: () => void; onSource?: (fact: FinancialFactEvidence) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), titleId = useId();
  const [view, setView] = useState(initialView);
  const restoreFocus = useRef(true);
  const contextKey = `${selectedPeriod?.from}:${selectedPeriod?.to}`;
  useEffect(() => {
    const element = dialog.current, trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!element) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close(); document.body.style.overflow = previousOverflow;
      if (restoreFocus.current && trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  // A changed context must never leave the previous period open in the analytical layer.
  const mountedContext = useRef(contextKey);
  useEffect(() => { if (mountedContext.current !== contextKey) onClose(); }, [contextKey, onClose]);
  const point = points.find(item => item.periodStart === selectedPeriod?.from && item.periodEnd === selectedPeriod?.to);
  function source(fact: FinancialFactEvidence) {
    restoreFocus.current = false; onClose();
    window.requestAnimationFrame(() => onSource?.(fact));
  }
  return <dialog ref={dialog} className="health-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => {
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"], summary, a[href]')).filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <header className="health-dialog-header"><div><p className="report-eyebrow">{view === "history" ? "Historia wskaźnika" : "Metodologia i dowody"}</p><h2 id={titleId}>{indicatorContent[code].name}</h2>
      <p className="health-muted">Wybrany okres: {selectedPeriod ? `${selectedPeriod.from} – ${selectedPeriod.to}` : "nie ustalono"} · {points[0]?.scope === "consolidated" ? "skonsolidowane" : "jednostkowe"}</p></div>
      <button type="button" aria-label="Zamknij analizę wskaźnika" autoFocus onClick={onClose}>✕</button></header>
    <div className="health-dialog-switch" role="group" aria-label="Widok analizy wskaźnika">
      <button type="button" aria-pressed={view === "history"} onClick={() => setView("history")}>Historia</button>
      <button type="button" aria-pressed={view === "methodology"} onClick={() => setView("methodology")}>Jak to obliczamy?</button>
    </div>
    {view === "history" ? <FinancialHistory name={indicatorContent[code].name} points={points} selectedPeriod={selectedPeriod} />
      : <FinancialIndicatorMethodology code={code} point={point} selectedPeriod={selectedPeriod} onSource={onSource ? source : undefined} />}
  </dialog>;
}
