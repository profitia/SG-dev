"use client";

import React, { useEffect, useRef, useState } from "react";
import type { FinancialData, FinancialPeriod } from "./contracts";
import { amountInThousands } from "./financial-labels";

type Scope = FinancialPeriod["scope"];
type Fact = FinancialPeriod["facts"][number];
type Row = { code: string; label: string; strong?: boolean };

const incomeGroups: { title: string; rows: Row[] }[] = [
  { title: "Przychody", rows: [
    { code: "PALA_NRFS", label: "Przychody netto ze sprzedaży i zrównane z nimi", strong: true },
    { code: "PALA_OOR", label: "Pozostałe przychody operacyjne" },
    { code: "PALA_FR", label: "Przychody finansowe" },
  ] },
  { title: "Koszty", rows: [
    { code: "PALA_OAC", label: "Koszty działalności operacyjnej", strong: true },
    { code: "PALA_OAC_MAEC", label: "Zużycie materiałów i energii" },
    { code: "PALA_OAC_ES", label: "Usługi obce" },
    { code: "PALA_OAC_R", label: "Wynagrodzenia" },
    { code: "PALA_OAC_SIAOBI", label: "Ubezpieczenia społeczne i inne świadczenia" },
    { code: "PALA_OAC_D", label: "Amortyzacja" },
    { code: "PALA_OAC_TAC", label: "Podatki i opłaty" },
    { code: "PALA_OAC_OCBT", label: "Pozostałe koszty rodzajowe" },
    { code: "PALA_OAC_VOGAMS", label: "Wartość sprzedanych towarów i materiałów" },
    { code: "PALA_OOC", label: "Pozostałe koszty operacyjne" },
    { code: "PALA_FC", label: "Koszty finansowe" },
    { code: "PALA_IT", label: "Podatek dochodowy" },
  ] },
  { title: "Wynik finansowy", rows: [
    { code: "PALA_PLFS", label: "Zysk lub strata ze sprzedaży" },
    { code: "PALA_PLFOA", label: "Zysk lub strata z działalności operacyjnej" },
    { code: "PALA_GPL", label: "Zysk lub strata brutto" },
    { code: "PALA_NPL", label: "Zysk lub strata netto", strong: true },
  ] },
];

const balanceGroups: { title: string; rows: Row[] }[] = [
  { title: "Aktywa", rows: [
    { code: "BS_A_FA", label: "Aktywa trwałe" },
    { code: "BS_A_CA", label: "Aktywa obrotowe" },
    { code: "BS_A_TA", label: "Aktywa razem", strong: true },
  ] },
  { title: "Pasywa", rows: [
    { code: "BS_LAE_E", label: "Kapitał własny" },
    { code: "BS_LAE_NC", label: "Kapitał podstawowy" },
    { code: "BS_LAE_LAPFL", label: "Zobowiązania i rezerwy na zobowiązania", strong: true },
    { code: "BS_LAE_LAPFL_LTL", label: "Zobowiązania długoterminowe" },
    { code: "BS_LAE_LAPFL_STL", label: "Zobowiązania krótkoterminowe" },
  ] },
];

function isComplete(period: FinancialPeriod): boolean {
  return period.facts.some((fact) => fact.metricCode.startsWith("BS_"))
    && period.facts.some((fact) => fact.metricCode.startsWith("PALA_"));
}

function periodQuality(period: FinancialPeriod): number {
  return (isComplete(period) ? 100000 : 0) + period.facts.length;
}

function availablePeriods(data: FinancialData | null | undefined): FinancialPeriod[] {
  return (data?.periods ?? []).filter((period) => period.facts.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(period.to));
}

export function defaultFinancialScope(data: FinancialData | null | undefined): Scope | null {
  const periods = availablePeriods(data).sort((a, b) => b.to.localeCompare(a.to) || periodQuality(b) - periodQuality(a));
  return (periods.find(isComplete) ?? periods[0])?.scope ?? null;
}

/** One best available statement per year and basis; no source values are changed. */
export function financialPeriodsByScope(data: FinancialData | null | undefined, scope: Scope): FinancialPeriod[] {
  const candidates = availablePeriods(data).filter((period) => period.scope === scope)
    .sort((a, b) => b.to.localeCompare(a.to) || periodQuality(b) - periodQuality(a));
  const byYear = new Map<string, FinancialPeriod>();
  for (const period of candidates) {
    const year = period.to.slice(0, 4);
    const previous = byYear.get(year);
    if (!previous || periodQuality(period) > periodQuality(previous)) byYear.set(year, period);
  }
  return [...byYear.values()].sort((a, b) => b.to.localeCompare(a.to));
}

export function latestAvailableFinancialYear(data: FinancialData | null | undefined): string | null {
  const scope = defaultFinancialScope(data);
  return scope ? financialPeriodsByScope(data, scope)[0]?.to.slice(0, 4) ?? null : null;
}

function factFor(period: FinancialPeriod, code: string): Fact | undefined {
  return period.facts.find((fact) => fact.metricCode === code);
}

function numberFor(period: FinancialPeriod, code: string): number | null {
  const fact = factFor(period, code);
  return fact ? amountInThousands(fact.amount, fact.currency, fact.unit) : null;
}

function formatNumber(number: number | null): string {
  return number === null ? "brak danych" : new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(number);
}

function MetricChart({ periods, code, title, color }: { periods: readonly FinancialPeriod[]; code: string; title: string; color: string }) {
  const points = periods.map((period) => ({ year: period.to.slice(0, 4), value: numberFor(period, code) }));
  const available = points.filter((point): point is { year: string; value: number } => point.value !== null);
  if (!available.length) return <div className="financial-chart financial-chart-empty"><h4>{title}</h4><p>brak danych</p></div>;
  const width = Math.max(480, periods.length * 84 + 40);
  const maxPositive = Math.max(0, ...available.map((point) => point.value));
  const minNegative = Math.min(0, ...available.map((point) => point.value));
  const hasNegative = minNegative < 0;
  const baseline = hasNegative ? 118 : 176;
  const positiveHeight = hasNegative ? 100 : 150;
  const negativeHeight = 54;
  return <div className="financial-chart">
    <h4>{title}</h4>
    <div className="financial-chart-scroll">
      <svg viewBox={`0 0 ${width} 220`} role="img" aria-label={`${title}; wartości w tysiącach złotych, lata ${points.map((point) => point.year).join(", ")}`}>
        <line x1="20" x2={width - 18} y1={baseline} y2={baseline} stroke="#b9c9cf" strokeWidth="1" />
        {points.map((point, index) => {
          const x = 30 + index * ((width - 60) / points.length);
          const barWidth = Math.min(44, (width - 60) / points.length - 12);
          const height = point.value === null ? 0 : point.value >= 0
            ? (maxPositive ? point.value / maxPositive * positiveHeight : 0)
            : (minNegative ? point.value / minNegative * negativeHeight : 0);
          const y = point.value !== null && point.value < 0 ? baseline : baseline - height;
          const labelY = point.value !== null && point.value < 0
            ? Math.min(195, baseline + height + 15)
            : Math.max(14, y - 7);
          return <g key={`${point.year}-${index}`}>
            {point.value !== null && <rect x={x} y={y} width={barWidth} height={Math.max(1, height)} rx="3" fill={color}>
              <title>{`${point.year}: ${formatNumber(point.value)} tys. zł`}</title>
            </rect>}
            {point.value !== null && <text className="financial-chart-value" x={x + barWidth / 2} y={labelY} textAnchor="middle" fontSize="10" fill="#153645">{formatNumber(point.value)}</text>}
            <text x={x + barWidth / 2} y="210" textAnchor="middle" fontSize="12" fill="#45606c">{point.year}</text>
          </g>;
        })}
      </svg>
    </div>
  </div>;
}

function FinancialTable({
  groups, periods, allPeriods, onChart,
}: {
  groups: { title: string; rows: Row[] }[];
  periods: readonly FinancialPeriod[];
  allPeriods: readonly FinancialPeriod[];
  onChart: (row: Row) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showMore, setShowMore] = useState(false);
  const visible = showMore ? allPeriods : periods;
  return <>
    <div className="financial-table-tools">
      <span>Kwoty w tys. zł · kolumny według roku sprawozdania</span>
      {allPeriods.length > 8 && <button type="button" onClick={() => setShowMore(!showMore)} aria-expanded={showMore}>
        {showMore ? "Pokaż 8 ostatnich lat" : `Więcej lat (${allPeriods.length - 8})`}
      </button>}
    </div>
    <div className="financial-table-scroll" ref={scrollRef} tabIndex={0} aria-label="Tabela finansowa przewijana poziomo">
      <table className="financial-table">
        <thead><tr><th scope="col">Pozycja sprawozdania</th>{visible.map((period) => <th scope="col" key={period.documentId} title={`${period.from} – ${period.to}`}>{period.to.slice(0, 4)}</th>)}<th scope="col">Wykres</th></tr></thead>
        <tbody>{groups.map((group) => {
          const rows = group.rows.filter((row) => allPeriods.some((period) => numberFor(period, row.code) !== null));
          return <FragmentGroup key={group.title} title={group.title} rows={rows} visible={visible} onChart={onChart} />;
        })}</tbody>
      </table>
    </div>
    {allPeriods.length > 5 && <div className="financial-scroll-controls" aria-label="Przewijanie lat">
      <button type="button" aria-label="Przesuń tabelę w lewo" onClick={() => scrollRef.current?.scrollBy({ left: -320, behavior: "smooth" })}>←</button>
      <button type="button" aria-label="Przesuń tabelę w prawo" onClick={() => scrollRef.current?.scrollBy({ left: 320, behavior: "smooth" })}>→</button>
    </div>}
  </>;
}

function FragmentGroup({ title, rows, visible, onChart }: { title: string; rows: Row[]; visible: readonly FinancialPeriod[]; onChart: (row: Row) => void }) {
  return <>
    <tr className="financial-table-group"><th scope="rowgroup" colSpan={visible.length + 2}>{title}</th></tr>
    {rows.length ? rows.map((row) => <tr className={row.strong ? "financial-table-total" : undefined} key={row.code}>
      <th scope="row">{row.label}</th>
      {visible.map((period) => <td key={period.documentId}>{formatNumber(numberFor(period, row.code))}</td>)}
      <td><button className="financial-row-chart" type="button" aria-label={`Pokaż wykres: ${row.label}`} onClick={() => onChart(row)}>
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="2" y="10" width="3" height="8" rx="1" /><rect x="8" y="5" width="3" height="13" rx="1" /><rect x="14" y="2" width="3" height="16" rx="1" /></svg>
      </button></td>
    </tr>) : <tr><td colSpan={visible.length + 2}>brak danych</td></tr>}
  </>;
}

export function FinancialDashboard({ data }: { data: FinancialData }) {
  const initialScope = defaultFinancialScope(data);
  const [requestedScope, setRequestedScope] = useState<Scope | null>(null);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scopes = Array.from(new Set(availablePeriods(data).map((period) => period.scope)));
  const scope = requestedScope && scopes.includes(requestedScope) ? requestedScope : initialScope;
  const allPeriods = scope ? financialPeriodsByScope(data, scope) : [];
  const eightPeriods = allPeriods.slice(0, 8);
  const chartPeriods = eightPeriods;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selectedRow && !dialog.open) dialog.showModal();
    if (!selectedRow && dialog.open) dialog.close();
  }, [selectedRow]);

  if (!allPeriods.length) return <p>brak danych</p>;

  return <div className="financial-dashboard">
    <div className="financial-dashboard-meta">
      <p>Dane finansowe prezentowane są w tysiącach złotych (tys. zł). Wartości na ekranie są zaokrąglone do 0,01 tys. zł.</p>
      {scopes.length > 1 && <div className="financial-scope" role="group" aria-label="Rodzaj sprawozdania">
        {scopes.map((choice) => <button type="button" key={choice} aria-pressed={scope === choice} onClick={() => setRequestedScope(choice)}>{choice === "standalone" ? "Jednostkowe" : "Skonsolidowane"}</button>)}
      </div>}
      <p>Ostatni dostępny raport: {allPeriods[0].to.slice(0, 4)} · {scope === "standalone" ? "dane jednostkowe" : "dane skonsolidowane"}</p>
    </div>
    <details className="financial-accordion" open>
      <summary>Rachunek zysków i strat</summary>
      <div className="financial-accordion-body">
        <div className="financial-charts">
          <MetricChart periods={chartPeriods} code="PALA_NRFS" title="Przychody" color="#173a59" />
          <MetricChart periods={chartPeriods} code="PALA_OAC" title="Koszty" color="#c47732" />
          <MetricChart periods={chartPeriods} code="PALA_NPL" title="Wynik finansowy netto" color="#347f78" />
        </div>
        <FinancialTable groups={incomeGroups} periods={eightPeriods} allPeriods={allPeriods} onChart={setSelectedRow} />
      </div>
    </details>
    <details className="financial-accordion" open>
      <summary>Bilans</summary>
      <div className="financial-accordion-body"><FinancialTable groups={balanceGroups} periods={eightPeriods} allPeriods={allPeriods} onChart={setSelectedRow} /></div>
    </details>
    <details className="financial-accordion">
      <summary>Analiza wskaźnikowa</summary>
      <div className="financial-accordion-body"><p>Obliczenia wskaźników będą dostępne w kolejnym etapie.</p></div>
    </details>
    <dialog className="financial-chart-dialog" ref={dialogRef} onClose={() => setSelectedRow(null)}>
      {selectedRow && <>
        <div className="financial-dialog-header"><h3>{selectedRow.label}</h3><button type="button" onClick={() => dialogRef.current?.close()} aria-label="Zamknij wykres">×</button></div>
        <p>Wartości w tysiącach złotych (tys. zł).</p>
        <MetricChart periods={allPeriods} code={selectedRow.code} title={selectedRow.label} color="#173a59" />
      </>}
    </dialog>
  </div>;
}
