"use client";
import { CanonButton, CanonElement, CanonSummary, CanonInput } from './ui-canon';

import React, { useRef, useState } from "react";
import { FinancialHistoryDialog } from "./FinancialHistoryDialog";
import { KysIcon } from "./kys-report";
import type { FinancialData, FinancialPeriod } from "./contracts";
import { amountInThousands } from "./financial-labels";

type Scope = FinancialPeriod["scope"];
type Fact = FinancialPeriod["facts"][number];
type Row = { code: string; label: string; strong?: boolean };
import { StatementWorkspace, StatementHistory, StatementIcon } from './statement-workspace';
import { statementRows, statementPoints } from './statement-model';
import { yearColor } from './financial-history-export';
export type FinancialPeriodSelection = { from: string; to: string };

const incomeGroups: { title: string; rows: Row[] }[] = [
  { title: "Przychody", rows: [
    { code: "PALA_NRFS", label: "Przychody netto ze sprzedaży i zrównane z nimi" },
    { code: "PALA_OOR", label: "Pozostałe przychody operacyjne" },
    { code: "PALA_FR", label: "Przychody finansowe" },
  ] },
  { title: "Koszty", rows: [
    { code: "PALA_OAC", label: "Koszty działalności operacyjnej" },
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

function FinancialTable({
  groups, periods, allPeriods, onChart, selectedPeriod,
}: {
  groups: { title: string; rows: Row[] }[];
  periods: readonly FinancialPeriod[];
  allPeriods: readonly FinancialPeriod[];
  onChart: (row: Row) => void;
  selectedPeriod?: FinancialPeriodSelection | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showMore, setShowMore] = useState(false);
  const selectedIsOlder = selectedPeriod && !periods.some(period => period.from === selectedPeriod.from && period.to === selectedPeriod.to);
  const visible = showMore || selectedIsOlder ? allPeriods : periods;
  return <>
    <div className="financial-table-tools">
      <span>Kwoty w tys. zł · kolumny według roku sprawozdania</span>
      {selectedIsOlder && <span>Pokazujemy wszystkie lata, aby zachować wybrany starszy okres.</span>}
      {allPeriods.length > 8 && !selectedIsOlder && <CanonButton canonId="SRM-C02" usage="financial-dashboard:01" type="button" onClick={() => setShowMore(!showMore)} aria-expanded={showMore}>
        {showMore ? "Pokaż 8 ostatnich lat" : `Więcej lat (${allPeriods.length - 8})`}
      </CanonButton>}
    </div>
    <div className="financial-table-scroll" ref={scrollRef} tabIndex={0} aria-label="Tabela finansowa przewijana poziomo">
      <CanonElement as="table" canonId="SRM-C48" usage="financial-dashboard:02" className="financial-table">
        <thead><tr><th scope="col">Pozycja sprawozdania</th>{visible.map((period,index) => <th scope="col" key={period.documentId} title={`${period.from} – ${period.to}`}><span className="srm-history-year-bar" style={{backgroundColor:yearColor(visible.length-1-index,visible.length),color:index<visible.length*.42?'white':'#003366'}}>{period.to.slice(0,4)}</span></th>)}<th scope="col">Wykres</th></tr></thead>
        <tbody>{groups.map((group) => {
          const rows = group.rows.filter((row) => allPeriods.some((period) => numberFor(period, row.code) !== null));
          return <FragmentGroup key={group.title} title={group.title} rows={rows} visible={visible} onChart={onChart} />;
        })}</tbody>
      </CanonElement>
    </div>
    {allPeriods.length > 5 && <div className="financial-scroll-controls" aria-label="Przewijanie lat">
      <CanonButton canonId="SRM-C02" usage="financial-dashboard:03" type="button" aria-label="Przesuń tabelę w lewo" onClick={() => scrollRef.current?.scrollBy({ left: -320, behavior: "smooth" })}>←</CanonButton>
      <CanonButton canonId="SRM-C02" usage="financial-dashboard:04" type="button" aria-label="Przesuń tabelę w prawo" onClick={() => scrollRef.current?.scrollBy({ left: 320, behavior: "smooth" })}>→</CanonButton>
    </div>}
  </>;
}

function FragmentGroup({ title, rows, visible, onChart }: { title: string; rows: Row[]; visible: readonly FinancialPeriod[]; onChart: (row: Row) => void; }) {
  return <>
    <tr className="financial-table-group"><th scope="rowgroup">{title}</th>{visible.map(period => <td key={period.documentId} aria-hidden="true" />)}<td aria-hidden="true" /></tr>
    {rows.length ? rows.map((row) => <tr className={row.strong ? "financial-table-total" : undefined} key={row.code}>
      <th scope="row">{row.label}</th>
      {visible.map((period) => <td key={period.documentId}>{formatNumber(numberFor(period, row.code))}</td>)}
      <td><CanonButton canonId="SRM-C04" usage="financial-dashboard:05" className="srm-statement-icon srm-row-chart" data-financial-metric={row.code} type="button" aria-label={`Pokaż wykres: ${row.label}`} onClick={() => onChart(row)}>
        <StatementIcon />
      </CanonButton></td>
    </tr>) : <tr><th scope="row">brak danych</th>{visible.map(period => <td key={period.documentId}>brak danych</td>)}<td /></tr>}
  </>;
}

export function FinancialDashboard({ data, onDownloadExcel, selectedScope, onScopeChange, selectedPeriod, exportOpen, onCloseExport }: { data: FinancialData; onDownloadExcel?: (scope: Scope, years: string[]) => Promise<void>;
  selectedScope?: Scope | null; onScopeChange?: (scope: Scope) => void; selectedPeriod?: FinancialPeriodSelection | null; exportOpen?: boolean; onCloseExport?: () => void }) {
  const [localExportOpen, setLocalExportOpen] = useState(false);
  const closeExport = () => { setLocalExportOpen(false); onCloseExport?.(); };
  const initialScope = defaultFinancialScope(data);
  const [requestedScope, setRequestedScope] = useState<Scope | null>(null);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [yearSelection, setYearSelection] = useState<{ scope: Scope; years: string[] } | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const scopes = Array.from(new Set(availablePeriods(data).map((period) => period.scope)));
  const preferredScope = selectedScope === undefined ? requestedScope : selectedScope;
  const scope = preferredScope && scopes.includes(preferredScope) ? preferredScope : initialScope;
  const allPeriods = scope ? financialPeriodsByScope(data, scope) : [];
  const activePeriod = selectedPeriod === undefined ? allPeriods[0] : allPeriods.find(period => period.from === selectedPeriod?.from && period.to === selectedPeriod?.to);
  const eightPeriods = allPeriods.slice(0, 8);
  const rows = statementRows(allPeriods);
  const availableYears = allPeriods.map((period) => period.to.slice(0, 4));
  const selectedYears = yearSelection?.scope === scope ? yearSelection.years.filter((year) => availableYears.includes(year)) : availableYears;

  if (!allPeriods.length) return <p>brak danych</p>;

  return <div className="srm-ui financial-dashboard">
    <div className="financial-dashboard-meta">
      <p>Dane finansowe prezentowane są w tysiącach złotych (tys. zł). Wartości na ekranie są zaokrąglone do 0,01 tys. zł.</p>
      {scopes.length > 1 && <div className="financial-scope" role="group" aria-label="Rodzaj sprawozdania">
        {scopes.map((choice) => <CanonButton canonId="SRM-C02" usage="financial-dashboard:06" type="button" key={choice} aria-pressed={scope === choice} onClick={() => { setRequestedScope(choice); onScopeChange?.(choice); }}>{choice === "standalone" ? "Jednostkowe" : "Skonsolidowane"}</CanonButton>)}
      </div>}
      <p>Wybrany okres: {activePeriod ? `${activePeriod.from} – ${activePeriod.to}` : "brak pasującego sprawozdania"}</p>
      <p>Ostatni dostępny raport: {allPeriods[0].to.slice(0, 4)} · {scope === "standalone" ? "dane jednostkowe" : "dane skonsolidowane"}</p>
    </div>
    {onDownloadExcel && exportOpen === undefined && <div className="financial-export-toolbar"><CanonButton canonId="SRM-C02" usage="financial-dashboard:07" type="button" onClick={() => setLocalExportOpen(true)} aria-haspopup="dialog"><KysIcon kind="download" />Pobierz do Excela</CanonButton></div>}
    {onDownloadExcel && (exportOpen ?? localExportOpen) && <FinancialHistoryDialog compact title="Pobierz do Excela" subtitle="Wybierz lata sprawozdawcze" onClose={closeExport}><div className="financial-excel-export">
      <p>Wybierz lata do pobrania. Plik zawiera pełne pozycje bilansu i RZiS wybranych sprawozdań. Kwoty zachowują walutę, skalę i dokładność źródła.</p>
      <div className="financial-excel-years" role="group" aria-label="Lata do pobrania">
        {availableYears.map((year) => <label key={year}><CanonInput canonId="SRM-C06" usage="financial-dashboard:08" type="checkbox" checked={selectedYears.includes(year)} onChange={(event) => {
          const next = event.target.checked ? [...selectedYears, year] : selectedYears.filter((selected) => selected !== year);
          setYearSelection({ scope: scope!, years: next });
        }} />{year}</label>)}
      </div>
      <div className="financial-excel-actions">
        <CanonButton canonId="SRM-C09" usage="financial-dashboard:09" type="button" onClick={() => setYearSelection({ scope: scope!, years: availableYears })}>Wszystkie lata</CanonButton>
        <CanonButton canonId="SRM-C02" usage="financial-dashboard:10" type="button" disabled={!selectedYears.length || exportBusy} onClick={async () => {
          setExportBusy(true);
          setExportError(null);
          try { await onDownloadExcel(scope!, selectedYears); closeExport(); }
          catch (error) { setExportError(error instanceof Error ? error.message : "Nie udało się pobrać pliku."); }
          finally { setExportBusy(false); }
        }}>{exportBusy ? "Przygotowywanie pliku…" : "Pobierz wybrane lata"}</CanonButton>
      </div>
      {exportError && <p role="alert" className="search-error">{exportError}</p>}
    </div></FinancialHistoryDialog>}
    <StatementWorkspace key={scope} rows={rows} years={availableYears.map(Number)} showTables={false} />
    <details className="financial-accordion" open>
      <CanonSummary canonId="SRM-C49" usage="financial-dashboard:11">Rachunek zysków i strat</CanonSummary>
      <div className="financial-accordion-body">
        <FinancialTable groups={incomeGroups} periods={eightPeriods} allPeriods={allPeriods} onChart={setSelectedRow} selectedPeriod={activePeriod} />
      </div>
    </details>
    <details className="financial-accordion" open>
      <CanonSummary canonId="SRM-C49" usage="financial-dashboard:12">Bilans</CanonSummary>
      <div className="financial-accordion-body"><FinancialTable groups={balanceGroups} periods={eightPeriods} allPeriods={allPeriods} onChart={setSelectedRow} selectedPeriod={activePeriod} /></div>
    </details>
    {selectedRow && <StatementHistory row={{id:selectedRow.code,name:selectedRow.label,section:scope==='standalone'?'Jednostkowe':'Skonsolidowane',group:'Sprawozdanie finansowe',points:statementPoints(allPeriods,selectedRow.code)}} onClose={()=>setSelectedRow(null)} />}
  </div>;
}
