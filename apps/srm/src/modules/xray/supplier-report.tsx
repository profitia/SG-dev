"use client";

import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { defaultFinancialScope, indicatorContent, useKysOverview, type KysOverviewModel, type KysDetailTarget, FinancialDataMount, financialPeriodsByScope, GeneralCompanyDataMount, JdgRegistryMount,
  KysPdfButton, type KysPdfSelection, VerclyKysMount, type FinancialPeriod, type FinancialPeriodSelection, type FinancialFactEvidence, type SupplierReportData } from "@profitia/srm-xray";
import { ReportNavigation, navigateReportSection } from "./report-navigation";
export { navigateReportSection } from "./report-navigation";
import { supplierNip, type DisplayCard, type ReportState, type SearchResult } from "./report-controller";

type Scope = FinancialPeriod["scope"];
export type SupplierReportContext = {
  supplier: SearchResult;
  metadata: SupplierReportData | null;
  financial: DisplayCard["financial"] | null;
  kys: ReportState["kys"];
  scope: Scope | null;
  setScope: (scope: Scope) => void;
  selectedPeriod: FinancialPeriodSelection | null;
  setPeriod: (period: FinancialPeriodSelection) => void;
  onSource: (fact: FinancialFactEvidence) => void;
  onIndicator: (code: string, history?: boolean) => void;
  onNavigate: (id: string) => void;
  kysOverview: KysOverviewModel; onKysDetails: (target: KysDetailTarget) => void;
  periods: SupplierReportData["financial"]["periods"];
  metadataBusy: boolean;
  metadataError: string | null;
};
const ReportContext = createContext<SupplierReportContext | null>(null);
export function useSupplierReportContext(): SupplierReportContext {
  const context = useContext(ReportContext);
  if (!context) throw new Error("Supplier report context is unavailable");
  return context;
}
const financialAreas = { liquidity: "Płynność i kapitał obrotowy", debt: "Zadłużenie i finansowanie",
  profitability: "Rentowność i stabilność wyników", cashFlow: "Gotówka i przepływy pieniężne" } as const;
type Slot = (context: SupplierReportContext) => ReactNode;
/** Optional content boundaries. Unimplemented sections have no DOM or navigation item. */
export type SupplierReportSlots = { summary?: Slot; financial?: Partial<Record<keyof typeof financialAreas, Slot>>; kys?: Slot; observations?: Slot };
/** Product error copy only; provider identity stays in the original contract and audit. */
export function reportMessage(message: string): string {
  if (/(?:MGBI|VERCLY)_[A-Z0-9_]+/i.test(message)) return "Nie można teraz odczytać danych raportu. Spróbuj ponownie.";
  return message.replace(/MGBI/gi, "Dane finansowe i rejestrowe").replace(/Vercly/gi, "Raport KYS");
}
function FinancialLimitations({ state, onReadMetadata }: { state: ReportState; onReadMetadata: () => void }) {
  const financial = state.result?.entityType === "COMPANY" ? state.result.card.financial : null;
  if (!financial) return null;
  const metadata = state.metadata?.financial;
  const notes: string[] = [];
  if (metadata?.freshness.freshness === "EXPIRED") notes.push("Dane finansowe mogą być nieaktualne. Wyniki dotyczą wskazanego okresu.");
  if (financial.status === "PARTIAL" || metadata?.completeness === "PARTIAL") notes.push("Dane finansowe są częściowe. Nie wszystkie wyniki są dostępne.");
  if (metadata?.limitations.includes("MAPPING_VERSION_OUTDATED")) notes.push("Część wyników wymaga aktualizacji. Dostępne sprawozdania pozostają w szczegółach.");
  if (metadata?.limitations.includes("FINANCIAL_FACTS_UNVERIFIED")) notes.push("Część danych nie została potwierdzona. Sprawdź ograniczenia poszczególnych wskaźników.");
  return <>
    {notes.map(note => <p key={note} className="health-data-note">{note}</p>)}
    {state.metadataBusy && <p role="status" className="report-metadata-note">Przygotowywanie zapisanych wyników…</p>}
    {!state.metadata && !state.metadataBusy && <div className="report-metadata-note"><p role="status">Nie można odczytać zapisanych wyników. Dostępne sprawozdania pozostają w szczegółach.</p><button type="button" onClick={onReadMetadata}>Ponów odczyt wyników</button></div>}
  </>;
}

export function SupplierReport({ state, onFetchKys, onReadMetadata, onRevealPesel, onDownloadExcel, onDownloadKysPdf, slots = {} }: {
  state: ReportState; onFetchKys: () => void; onReadMetadata: () => void;
  onRevealPesel: (token: string) => Promise<string>; onDownloadExcel: (scope: Scope, years: string[]) => Promise<void>;
  onDownloadKysPdf?: (selection: KysPdfSelection, signal: AbortSignal) => Promise<void>;
  slots?: SupplierReportSlots;
}) {
  const root = useRef<HTMLDivElement>(null), kysDetails = useRef<HTMLDetailsElement>(null);
  const financial = state.result?.entityType === "COMPANY" ? state.result.card.financial : null;
  const kysOverviewModel = useKysOverview({ nip: supplierNip(state.result) ?? "", entityType: state.result?.entityType ?? "COMPANY", section: state.kys, metadata: state.metadata, loading: state.kysBusy || state.metadataBusy });
  const initialScope = defaultFinancialScope(financial?.data);
  const [requestedScope, setRequestedScope] = useState<Scope | null>(null);
  const [requestedPeriod, setRequestedPeriod] = useState<(FinancialPeriodSelection & { scope: Scope }) | null>(null);
  const scope = requestedScope && financialPeriodsByScope(financial?.data, requestedScope).length ? requestedScope : initialScope;
  const periods = scope ? state.metadata?.financial.periods.filter(period => period.scope === scope) ?? [] : [];
  const selectionPeriods = state.metadata ? periods : scope ? financialPeriodsByScope(financial?.data, scope) : [];
  const selectedPeriod = requestedPeriod?.scope === scope && selectionPeriods.some(period => period.from === requestedPeriod.from && period.to === requestedPeriod.to)
    ? { from: requestedPeriod.from, to: requestedPeriod.to } : selectionPeriods[0] ? { from: selectionPeriods[0].from, to: selectionPeriods[0].to } : null;
  function setScope(next: Scope) { setRequestedScope(next); setRequestedPeriod(null); }
  function setPeriod(next: FinancialPeriodSelection) {
    if (scope && selectionPeriods.some(period => period.from === next.from && period.to === next.to)) setRequestedPeriod({ ...next, scope });
  }
  function onSource(fact: FinancialFactEvidence) {
    // A source action changes the same shared context; it never reads the provider.
    if (fact.scope !== scope || !periods.some(period => period.from === fact.periodStart && period.to === fact.periodEnd && period.documentRef === fact.documentRef)) return;
    setPeriod({ from: fact.periodStart, to: fact.periodEnd });
    window.requestAnimationFrame(() => {
      if (!root.current) return;
      navigateReportSection(root.current, "report-financial-details");
      const row = Array.from(root.current.querySelectorAll<HTMLElement>("[data-financial-metric]")).find(element => element.dataset.financialMetric === fact.metricCode)?.closest("tr");
      if (!row) return;
      let ancestor: HTMLElement | null = row;
      while (ancestor && ancestor !== root.current) { if (ancestor.tagName === "DETAILS") (ancestor as HTMLDetailsElement).open = true; ancestor = ancestor.parentElement; }
      const heading = row.querySelector<HTMLElement>("th"); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); } row.scrollIntoView({ block: "center" });
    });
  }
  function onNavigate(id: string) { if (root.current) navigateReportSection(root.current, id); }
  function onKysDetails(group: KysDetailTarget) {
    if (!root.current || !kysOverviewModel.available) return;
    const target = Array.from(root.current.querySelectorAll<HTMLElement>("[data-kys-detail]")).find(node => node.dataset.kysDetail === group);
    if (!target) return;
    navigateReportSection(root.current, target.id);
    const heading = target.querySelector<HTMLElement>("h3");
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }
  function onIndicator(code: string, history = false) {
    if (!root.current || !Object.hasOwn(indicatorContent, code)) return;
    const card = Array.from(root.current.querySelectorAll<HTMLElement>("[data-financial-indicator]")).find(node => node.dataset.financialIndicator === code);
    if (!card) return;
    const methodology = card.querySelector<HTMLDetailsElement>(".health-methodology");
    if (methodology) methodology.open = true;
    const button = card.querySelector<HTMLButtonElement>(".health-card-actions button");
    if (history && button?.getAttribute("aria-expanded") === "false") button.click();
    navigateReportSection(root.current, card.id);
    const heading = card.querySelector<HTMLElement>("h4"); heading?.focus({ preventScroll: true });
  }
  useEffect(() => { if (state.kys.status !== "NOT_REQUESTED" && kysDetails.current) kysDetails.current.open = true; }, [state.kys]);
  if (!state.result) return null;
  const supplier = state.result, metadata = state.metadata;
  const context: SupplierReportContext = { supplier, metadata, financial, kys: state.kys, scope, setScope, selectedPeriod, setPeriod, onSource, onIndicator, onNavigate, kysOverview: kysOverviewModel, onKysDetails, periods,
    metadataBusy: state.metadataBusy, metadataError: state.metadataError };
  const summary = slots.summary?.(context), observations = slots.observations?.(context), kysOverview = slots.kys?.(context);
  const areas = Object.entries(financialAreas).map(([key, title]) => ({ key, title, content: slots.financial?.[key as keyof typeof financialAreas]?.(context) })).filter(area => area.content != null && area.content !== false);
  const navigation = [{ id: summary ? "report-summary" : "supplier-identity", label: "Podsumowanie" },
    ...(areas.length || supplier.entityType === "COMPANY" ? [{ id: areas.length ? "report-finance" : "report-financial-details", label: "Finanse" }] : []),
    ...(observations ? [{ id: "report-observations", label: "Obserwacje" }] : []),
    { id: "report-details", label: "Dane szczegółowe" }, { id: "report-kys", label: "KYS" }];
  const name = supplier.entityType === "JDG" ? supplier.section.data?.entries[0]?.name : supplier.card.general.data?.legalName ?? supplier.card.identity.name;
  return <ReportContext.Provider value={context}><div ref={root} className="supplier-report">
    <section id="supplier-identity" className="report-identity" aria-labelledby="supplier-identity-title">
      <div className="report-identity-heading"><div><p className="report-eyebrow">Raport dostawcy</p><h2 id="supplier-identity-title" tabIndex={-1}>{name ?? "Nazwa niedostępna"}</h2>
        <p>NIP: {supplierNip(supplier)} · {supplier.entityType === "JDG" ? "Jednoosobowa działalność gospodarcza" : `KRS: ${supplier.card.identity.krs ?? "nie ustalono"}`}</p></div>
        {selectedPeriod && <p className="report-period-label">Okres finansowy: <strong>{selectedPeriod.from} – {selectedPeriod.to}</strong><span>{scope === "standalone" ? "Jednostkowe" : "Skonsolidowane"}</span></p>}
      </div>
    </section>
    <ReportNavigation root={root} items={navigation} />
    {summary && <section id="report-summary" className="report-content-section" aria-labelledby="report-summary-title"><h2 id="report-summary-title" tabIndex={-1}>Najważniejsze informacje</h2>{summary}</section>}
    {!!areas.length && <section id="report-finance" className="report-content-section" aria-labelledby="report-finance-title"><h2 id="report-finance-title" tabIndex={-1}>Kondycja finansowa</h2>
      <p className="health-dashboard-note">Zapisane wyniki finansowe. Istotność wskaźnika nie jest oceną ryzyka; kierunek zmiany nie oznacza poprawy ani pogorszenia kondycji.</p>
      {selectionPeriods.length > 0 && <div className="health-context-controls">
        <div role="group" aria-label="Zakres dashboardu">{(["standalone", "consolidated"] as const).filter(choice => financialPeriodsByScope(financial?.data, choice).length).map(choice => <button key={choice} type="button" aria-pressed={scope === choice} onClick={() => setScope(choice)}>{choice === "standalone" ? "Jednostkowe" : "Skonsolidowane"}</button>)}</div>
        <label>Okres sprawozdawczy<select aria-label="Okres sprawozdawczy" value={selectedPeriod ? `${selectedPeriod.from}:${selectedPeriod.to}` : ""} onChange={event => { const period = selectionPeriods.find(item => `${item.from}:${item.to}` === event.target.value); if (period) setPeriod(period); }}>
          {selectionPeriods.map(period => <option key={`${period.from}:${period.to}`} value={`${period.from}:${period.to}`}>{period.from} – {period.to}</option>)}
        </select></label>
      </div>}
      <FinancialLimitations state={state} onReadMetadata={onReadMetadata} />
      <div className="report-financial-areas">{areas.map(area => <section key={area.key} aria-label={area.title}><h3>{area.title}</h3>{area.content}</section>)}</div></section>}
    {observations && <section id="report-observations" className="report-content-section" aria-labelledby="report-observations-title"><h2 id="report-observations-title" tabIndex={-1}>Obserwacje i kwestie do sprawdzenia</h2>{observations}</section>}
    <section id="report-details" className="report-details" aria-labelledby="report-details-title">
      <div className="report-details-heading"><h2 id="report-details-title" tabIndex={-1}>Dane szczegółowe</h2><p>Pełne zestawienia i dotychczasowe funkcje raportowania.</p></div>
      <details className="report-detail" id="report-registry-details"><summary>Dane identyfikacyjne i rejestrowe</summary><div className="report-detail-body">
        {supplier.entityType === "JDG" ? <JdgRegistryMount section={supplier.section} /> : <GeneralCompanyDataMount section={supplier.card.general} />}
      </div></details>
      {supplier.entityType === "COMPANY" && <details className="report-detail" id="report-financial-details" open><summary>Sprawozdania finansowe i wskaźniki</summary><div className="report-detail-body">
        {!areas.length && <FinancialLimitations state={state} onReadMetadata={onReadMetadata} />}
        <FinancialDataMount section={supplier.card.financial} onDownloadExcel={onDownloadExcel} selectedScope={scope} onScopeChange={setScope} selectedPeriod={selectedPeriod} />
      </div></details>}
    </section>
    <section id="report-kys" className="report-content-section" aria-labelledby="report-kys-title">
      <div className="report-kys-action"><div><h2 id="report-kys-title" tabIndex={-1}>Raport KYS</h2><p>{state.kys.status === "NOT_REQUESTED" ? "Raport KYS nie został jeszcze pobrany w tym widoku." : "Pełny raport i stan pobierania znajdziesz poniżej."}</p>
        <p>Raport pobierasz tylko na własne żądanie.</p>
        {state.kys.status === "NOT_REQUESTED" && metadata?.kys.reportAvailable && <p>Zapisany raport jest dostępny. Użyj przycisku, aby go wyświetlić.</p>}</div>
        <button type="button" onClick={onFetchKys} disabled={state.kysBusy || (supplier.entityType === "JDG" && !supplier.section.data?.entries.length)}>
          {state.kysBusy ? "Przygotowywanie raportu KYS…" : state.kys.status === "NOT_REQUESTED" ? "Pobierz raport KYS" : "Pobierz raport KYS ponownie"}</button>
        {state.kysError && <p role="alert" className="search-error">{reportMessage(state.kysError)}</p>}
        {state.kys.status !== "NOT_REQUESTED" && <a href="#report-kys-details" onClick={event => { event.preventDefault(); if (root.current) navigateReportSection(root.current, "report-kys-details"); }}>Przejdź do pełnego raportu KYS</a>}
      </div>
      {kysOverview}
      {metadata?.kys.freshness.freshness === "EXPIRED" && <p className="health-data-note">Poprzedni raport KYS stracił ważność. Pobranie wymaga osobnego działania.</p>}
      {(state.kys.status === "PARTIAL" || metadata?.kys.completeness === "PARTIAL") && <p className="health-data-note">Raport KYS jest częściowy. Nie wszystkie sprawdzenia zwróciły dane.</p>}
      {kysOverviewModel.available && metadata?.kys.exportRef && metadata.kys.freshness.retrievedAt && onDownloadKysPdf && <KysPdfButton
        key={`${supplierNip(supplier)}:${supplier.entityType}:${metadata.kys.exportRef}`}
        selection={{ nip: supplierNip(supplier) ?? "", entityType: supplier.entityType, retrievedAt: metadata.kys.freshness.retrievedAt, exportRef: metadata.kys.exportRef }}
        onDownload={onDownloadKysPdf} />}
      {kysOverviewModel.available && !metadata?.kys.exportRef && <p role="status">Nie potwierdzono wersji do eksportu PDF. Szczegóły raportu pozostają dostępne.</p>}
      <details className="report-detail" id="report-kys-details" ref={kysDetails}><summary>Pełny raport KYS</summary><div className="report-detail-body">
        {state.kys.status === "NOT_REQUESTED" ? <p>Raport KYS nie został jeszcze pobrany. Zamów go przyciskiem „Pobierz raport KYS”.</p>
          : state.kys.data && !kysOverviewModel.available ? <p role="status">{state.kysBusy || state.metadataBusy ? "Sprawdzanie dostępności raportu…" : kysOverviewModel.message}</p>
          : <VerclyKysMount section={state.kys} entityType={supplier.entityType} onRevealPesel={onRevealPesel} />}
      </div></details>
    </section>
  </div></ReportContext.Provider>;
}
