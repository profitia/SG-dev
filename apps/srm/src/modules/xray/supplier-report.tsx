"use client";

import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { defaultFinancialScope, FinancialDataMount, financialPeriodsByScope, GeneralCompanyDataMount, JdgRegistryMount,
  VerclyKysMount, type FinancialPeriod, type ReportFreshness, type SectionStatus, type SupplierReportData } from "@profitia/srm-xray";
import { supplierNip, type DisplayCard, type ReportState, type SearchResult } from "./report-controller";

type Scope = FinancialPeriod["scope"];
export type SupplierReportContext = {
  supplier: SearchResult;
  metadata: SupplierReportData | null;
  financial: DisplayCard["financial"] | null;
  kys: ReportState["kys"];
  scope: Scope | null;
  setScope: (scope: Scope) => void;
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
const statuses: Record<SectionStatus, string> = { SUCCESS: "Dostępne", PARTIAL: "Dane częściowe", EMPTY: "Brak danych",
  ERROR: "Źródło niedostępne", PENDING: "Pobieranie", NOT_REQUESTED: "Nie pobrano" };
const freshnessLabels: Record<ReportFreshness["freshness"], string> = { FRESH: "Cache aktualny", EXPIRED: "Cache wygasł", UNKNOWN: "Aktualność nieustalona", ABSENT: "Brak zapisanego raportu" };
export function reportDate(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "nie ustalono";
  return new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
export function navigateReportSection(root: HTMLElement, id: string) {
  const target = Array.from(root.querySelectorAll<HTMLElement>("[id]")).find(element => element.id === id);
  if (!target) return;
  let ancestor: HTMLElement | null = target;
  while (ancestor && ancestor !== root) { if (ancestor.tagName === "DETAILS") (ancestor as HTMLDetailsElement).open = true; ancestor = ancestor.parentElement; }
  const focusTarget = target.querySelector<HTMLElement>(":scope > summary, :scope > h2") ?? target;
  focusTarget.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: "auto", block: "start" });
}
function Freshness({ title, status, freshness, retrievedAt }: { title: string; status: SectionStatus; freshness?: ReportFreshness; retrievedAt?: string | null }) {
  return <div className="report-source-status">
    <h3>{title}</h3><strong>{statuses[status]}</strong>
    {freshness && <span className="report-freshness">{freshnessLabels[freshness.freshness]}</span>}
    <p>Pobrano: {reportDate(freshness?.retrievedAt ?? retrievedAt)}</p>
    <p>Ostatnia kontrola źródła: {reportDate(freshness?.checkedAt)}</p>
  </div>;
}
function SourceDetails({ state }: { state: ReportState }) {
  const metadata = state.metadata;
  return <section id="report-sources" className="report-sources" aria-labelledby="report-sources-title">
    <h2 id="report-sources-title" tabIndex={-1}>Źródła i aktualność</h2>
    <p>Okres sprawozdawczy opisuje dane finansowe. Data kontroli źródła opisuje sprawdzenie dostawcy danych. Są to odrębne informacje.</p>
    <div className="report-sources-grid">
      <section aria-label="Źródło finansów"><h3>Finanse · MGBI</h3>
        <dl className="report-source-facts"><dt>Pobranie danych</dt><dd>{reportDate(metadata?.financial.freshness.retrievedAt ?? (state.result?.entityType === "COMPANY" ? state.result.card.financial.retrievedAt : null))}</dd>
          <dt>Kontrola źródła</dt><dd>{reportDate(metadata?.financial.freshness.checkedAt)}</dd>
          <dt>Wygaśnięcie cache</dt><dd>{reportDate(metadata?.financial.freshness.cacheExpiresAt)}</dd>
          <dt>Odczyt raportu</dt><dd>{metadata ? "Z zapisanych danych" : "nie ustalono"}</dd>
          <dt>Ostatni sposób pozyskania</dt><dd>{metadata?.financial.freshness.lastRetrievalMethod === "CACHE" ? "Cache" : metadata?.financial.freshness.lastRetrievalMethod === "PROVIDER" ? "Dostawca danych" : "nie ustalono"}</dd></dl>
        {metadata?.financial.periods.length ? <details className="report-period-list"><summary>Dostępne okresy sprawozdawcze</summary><ul>
          {metadata.financial.periods.map(period => <li key={`${period.scope}:${period.from}:${period.to}`}>{period.from} – {period.to} · {period.scope === "standalone" ? "jednostkowe" : "skonsolidowane"}</li>)}
        </ul></details> : <p>{state.result?.entityType === "JDG" ? "Dla JDG nie udostępniamy sprawozdania finansowego spółki." : "Brak zapisanych okresów w metadanych."}</p>}
        {!!metadata?.financial.limitations.length && <p className="xray-warning">Ograniczenia danych: {metadata.financial.limitations.includes("FINANCIAL_CACHE_EXPIRED") ? "cache wygasł; " : ""}
          {metadata.financial.limitations.includes("MAPPING_VERSION_OUTDATED") ? "reprezentacja wymaga aktualizacji; " : ""}
          {metadata.financial.limitations.includes("FINANCIAL_FACTS_UNVERIFIED") ? "część wartości wymaga potwierdzenia." : ""}</p>}
      </section>
      <section aria-label="Źródło KYS"><h3>KYS · Vercly</h3>
        <dl className="report-source-facts"><dt>Pobranie raportu</dt><dd>{reportDate(metadata?.kys.freshness.retrievedAt ?? state.kys.retrievedAt)}</dd>
          <dt>Kontrola źródła</dt><dd>{reportDate(metadata?.kys.freshness.checkedAt)}</dd>
          <dt>Wygaśnięcie cache</dt><dd>{reportDate(metadata?.kys.freshness.cacheExpiresAt)}</dd>
          <dt>Koniec retencji</dt><dd>{reportDate(metadata?.kys.freshness.retentionUntil)}</dd>
          <dt>Ostatnia próba pobrania</dt><dd>{reportDate(metadata?.kys.lastAttemptAt)}</dd>
          <dt>Sposób pozyskania</dt><dd>{metadata?.kys.freshness.lastRetrievalMethod === "CACHE" ? "Cache" : metadata?.kys.freshness.lastRetrievalMethod === "PROVIDER" ? "Vercly" : "nie ustalono"}</dd></dl>
        {metadata && <p>{metadata.kys.completeness === "COMPLETE" ? "Zapisany raport kompletny." : metadata.kys.completeness === "PARTIAL" ? "Raport częściowy — nie wszystkie źródła zwróciły dane." : "Kompletność raportu nieustalona."}</p>}
        {metadata?.kys.freshness.freshness === "EXPIRED" && <p className="xray-warning">Ważność zapisanego raportu KYS wygasła. Pobranie wymaga osobnego działania.</p>}
      </section>
    </div>
    <p className="report-source-note">Brak danych nie oznacza wartości zero ani wykonania kontroli bez wykrytego sygnału.</p>
  </section>;
}

export function SupplierReport({ state, onFetchKys, onReadMetadata, onRevealPesel, onDownloadExcel, slots = {} }: {
  state: ReportState; onFetchKys: () => void; onReadMetadata: () => void;
  onRevealPesel: (token: string) => Promise<string>; onDownloadExcel: (scope: Scope, years: string[]) => Promise<void>;
  slots?: SupplierReportSlots;
}) {
  const root = useRef<HTMLDivElement>(null), kysDetails = useRef<HTMLDetailsElement>(null);
  const financial = state.result?.entityType === "COMPANY" ? state.result.card.financial : null;
  const initialScope = defaultFinancialScope(financial?.data);
  const [requestedScope, setScope] = useState<Scope | null>(null);
  const scope = requestedScope && financialPeriodsByScope(financial?.data, requestedScope).length ? requestedScope : initialScope;
  useEffect(() => { if (state.kys.status !== "NOT_REQUESTED" && kysDetails.current) kysDetails.current.open = true; }, [state.kys]);
  if (!state.result) return null;
  const supplier = state.result, metadata = state.metadata;
  const context: SupplierReportContext = { supplier, metadata, financial, kys: state.kys, scope, setScope, periods: metadata?.financial.periods.filter(period => period.scope === scope) ?? [],
    metadataBusy: state.metadataBusy, metadataError: state.metadataError };
  const summary = slots.summary?.(context), observations = slots.observations?.(context), kysOverview = slots.kys?.(context);
  const areas = Object.entries(financialAreas).map(([key, title]) => ({ key, title, content: slots.financial?.[key as keyof typeof financialAreas]?.(context) })).filter(area => area.content != null && area.content !== false);
  const navigation = [{ id: summary ? "report-summary" : "supplier-identity", label: "Podsumowanie" }, { id: areas.length ? "report-finance" : "report-financial-details", label: "Finanse" },
    { id: "report-kys", label: "KYS" }, ...(observations ? [{ id: "report-observations", label: "Obserwacje" }] : []),
    { id: "report-details", label: "Dane szczegółowe" }, { id: "report-sources", label: "Źródła" }].filter(item => item.id !== "report-financial-details" || supplier.entityType === "COMPANY");
  const name = supplier.entityType === "JDG" ? supplier.section.data?.entries[0]?.name : supplier.card.general.data?.legalName ?? supplier.card.identity.name;
  const latest = context.periods[0];
  return <ReportContext.Provider value={context}><div ref={root} className="supplier-report">
    <section id="supplier-identity" className="report-identity" aria-labelledby="supplier-identity-title">
      <div className="report-identity-heading"><div><p className="report-eyebrow">Raport dostawcy</p><h2 id="supplier-identity-title" tabIndex={-1}>{name ?? "Nazwa niedostępna"}</h2>
        <p>NIP: {supplierNip(supplier)} · {supplier.entityType === "JDG" ? "Jednoosobowa działalność gospodarcza" : `KRS: ${supplier.card.identity.krs ?? "nie ustalono"}`}</p></div>
        {latest && <p className="report-period-label">Okres finansowy: <strong>{latest.from} – {latest.to}</strong><span>{scope === "standalone" ? "Jednostkowe" : "Skonsolidowane"}</span></p>}
      </div>
      <div className="report-status-grid">
        {supplier.entityType === "COMPANY" ? <Freshness title="Finanse · MGBI" status={financial!.status} freshness={metadata?.financial.freshness} retrievedAt={financial!.retrievedAt} />
          : <div className="report-source-status"><h3>Dane rejestrowe · CEIDG</h3><strong>{statuses[supplier.section.status]}</strong><p>Pobrano: {reportDate(supplier.section.retrievedAt)}</p><p>Sprawozdanie finansowe spółki nie dotyczy JDG.</p></div>}
        <Freshness title="Raport KYS · Vercly" status={state.kys.status} freshness={metadata?.kys.freshness} retrievedAt={state.kys.retrievedAt} />
      </div>
      {state.metadataBusy && <p role="status" className="report-metadata-note">Odczytywanie metadanych aktualności…</p>}
      {state.metadataError && <div className="report-metadata-note"><p role="status">Metadane aktualności są niedostępne. Dostępne raporty pozostają poniżej.</p><button type="button" onClick={onReadMetadata}>Ponów odczyt metadanych</button></div>}
      {metadata?.financial.freshness.freshness === "EXPIRED" && <p className="xray-warning">Pokazujemy zapisane dane finansowe z wygasłego cache.</p>}
    </section>
    <nav className="report-navigation" aria-label="Sekcje raportu">
      <div className="report-navigation-desktop">{navigation.map(item => <a key={item.id} href={`#${item.id}`} onClick={event => {
        event.preventDefault(); if (root.current) navigateReportSection(root.current, item.id);
      }}>{item.label}</a>)}</div>
      <label className="report-navigation-mobile">Przejdź do sekcji<select aria-label="Przejdź do sekcji" defaultValue="" onChange={event => {
        if (root.current) navigateReportSection(root.current, event.target.value); event.target.value = "";
      }}><option value="">Wybierz sekcję…</option>{navigation.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    </nav>
    {summary && <section id="report-summary" className="report-content-section" aria-labelledby="report-summary-title"><h2 id="report-summary-title" tabIndex={-1}>Podsumowanie dostawcy</h2>{summary}</section>}
    {!!areas.length && <section id="report-finance" className="report-content-section" aria-labelledby="report-finance-title"><h2 id="report-finance-title" tabIndex={-1}>Kondycja finansowa</h2>
      <div className="report-financial-areas">{areas.map(area => <section key={area.key} aria-label={area.title}><h3>{area.title}</h3>{area.content}</section>)}</div></section>}
    <section id="report-kys" className="report-content-section report-kys-action" aria-labelledby="report-kys-title">
      <div><h2 id="report-kys-title" tabIndex={-1}>Raport KYS</h2><p>{state.kys.status === "NOT_REQUESTED" ? "Raport KYS nie został jeszcze pobrany w tym widoku." : "Pełny raport i stan pobierania znajdziesz w danych szczegółowych."}</p>
        <p>Raport pobierasz na osobne żądanie. Obowiązuje niezależny cache KYS.</p>
        {state.kys.status === "NOT_REQUESTED" && metadata?.kys.reportAvailable && <p>Zapisany raport jest dostępny. Użyj przycisku, aby wyświetlić go zgodnie z istniejącym mechanizmem cache.</p>}</div>
      <button type="button" onClick={onFetchKys} disabled={state.kysBusy || (supplier.entityType === "JDG" && !supplier.section.data?.entries.length)}>
        {state.kysBusy ? "Przygotowywanie raportu KYS…" : state.kys.status === "NOT_REQUESTED" ? "Pobierz raport KYS" : "Pobierz raport KYS ponownie"}</button>
      {state.kysError && <p role="alert" className="search-error">{state.kysError}</p>}{kysOverview}
      {state.kys.status !== "NOT_REQUESTED" && <a href="#report-kys-details" onClick={event => { event.preventDefault(); if (root.current) navigateReportSection(root.current, "report-kys-details"); }}>Przejdź do pełnego raportu KYS</a>}
    </section>
    {observations && <section id="report-observations" className="report-content-section" aria-labelledby="report-observations-title"><h2 id="report-observations-title" tabIndex={-1}>Obserwacje i kwestie do sprawdzenia</h2>{observations}</section>}
    <section id="report-details" className="report-details" aria-labelledby="report-details-title">
      <div className="report-details-heading"><h2 id="report-details-title" tabIndex={-1}>Dane szczegółowe</h2><p>Pełne zestawienia i dotychczasowe funkcje raportowania.</p></div>
      <details className="report-detail" id="report-registry-details"><summary>Dane identyfikacyjne i rejestrowe</summary><div className="report-detail-body">
        {supplier.entityType === "JDG" ? <JdgRegistryMount section={supplier.section} /> : <GeneralCompanyDataMount section={supplier.card.general} />}
      </div></details>
      {supplier.entityType === "COMPANY" && <details className="report-detail" id="report-financial-details" open><summary>Sprawozdania finansowe i wskaźniki</summary><div className="report-detail-body">
        <FinancialDataMount section={supplier.card.financial} onDownloadExcel={onDownloadExcel} selectedScope={scope} onScopeChange={setScope} />
      </div></details>}
      <details className="report-detail" id="report-kys-details" ref={kysDetails}><summary>Pełny raport KYS</summary><div className="report-detail-body">
        {state.kys.status === "NOT_REQUESTED" ? <p>Raport KYS nie został jeszcze pobrany. Zamów go przyciskiem „Pobierz raport KYS”.</p>
          : <VerclyKysMount section={state.kys} entityType={supplier.entityType} onRevealPesel={onRevealPesel} />}
      </div></details>
    </section>
    <SourceDetails state={state} />
  </div></ReportContext.Provider>;
}
