"use client";
import { CanonButton, CanonElement, CanonSummary, KysIcon, formatKysRetrievedAt } from '@profitia/srm-xray';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { SupplierWebIdentity, type SupplierWebIdentityData, defaultFinancialScope, indicatorContent, useKysOverview, type KysOverviewModel, type KysDetailTarget, FinancialDataMount, financialPeriodsByScope, GeneralCompanyDataMount, JdgRegistryMount,
  KysPdfButton, KysKrsButton, type KysPdfSelection, VerclyKysMount, type FinancialPeriod, type FinancialPeriodSelection, type FinancialFactEvidence, type SupplierReportData } from "@profitia/srm-xray";
import { FinancialPeriodSelector } from "./financial-period-selector";
import { ReportNavigation, navigateReportSection } from "./report-navigation";
export { navigateReportSection } from "./report-navigation";
import { reportAvailability, ReportAvailabilityView, type ReportAvailability, inactiveJdgMessage } from "@profitia/srm-xray";
import { supplierNip, inactiveSupplier, type DisplayCard, type ReportState, type SearchResult } from "./report-controller";
import {SupplierLocations} from './supplier-locations-view';
import {createSupplierWebRequest} from './supplier-web-request';

type Scope = FinancialPeriod["scope"];
export type SupplierReportContext = {
  availability: ReportAvailability;
  financialIndicatorsTarget: HTMLElement | null;
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
export type SupplierReportSlots = { summary?: Slot; scanner?: Slot; financial?: Partial<Record<keyof typeof financialAreas, Slot>>; kys?: Slot; observations?: Slot };
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
  if (metadata?.limitations.includes("MAPPING_VERSION_OUTDATED")) notes.push("Część wyników wymaga aktualizacji. Dostępne sprawozdania pozostają w szczegółach.");
  return <>
    {notes.map(note => <p key={note} className="health-data-note">{note}</p>)}
    {state.metadataBusy && <p role="status" className="report-metadata-note">Przygotowywanie zapisanych wyników…</p>}
    {!state.metadata && !state.metadataBusy && <div className="report-metadata-note"><p role="status">Nie można odczytać zapisanych wyników. Dostępne sprawozdania pozostają w szczegółach.</p><CanonButton canonId="SRM-C02" usage="supplier-report:01" type="button" onClick={onReadMetadata}>Ponów odczyt wyników</CanonButton></div>}
  </>;
}

export function SupplierReport({ state, onFetchKys, onReadMetadata, onRevealPesel, onDownloadExcel, onDownloadKysPdf, onDownloadKrsPdf, slots = {} }: {
  state: ReportState; onFetchKys: () => void; onReadMetadata: () => void;
  onRevealPesel: (token: string) => Promise<string>; onDownloadExcel: (scope: Scope, years: string[]) => Promise<void>;
  onDownloadKysPdf?: (selection: KysPdfSelection, signal: AbortSignal) => Promise<void>;
  onDownloadKrsPdf?: (selection: KysPdfSelection, signal: AbortSignal) => Promise<void>;
  slots?: SupplierReportSlots;
}) {
  const [financialIndicatorsTarget, setFinancialIndicatorsTarget] = useState<HTMLDivElement | null>(null);
  const root = useRef<HTMLDivElement>(null);
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
    const disclosure = root.current.querySelector<HTMLDetailsElement>("details#report-kys");
    if (disclosure) disclosure.open = true;
    root.current.querySelector<HTMLButtonElement>(`[data-kys-tab-for~="${group}"]`)?.click();
    window.requestAnimationFrame(() => {
      const target = root.current?.querySelector<HTMLElement>(`[data-kys-detail="${group}"]`);
      if (!target) return;
      target.scrollIntoView({ block: "start", behavior: "smooth" });
      const heading = target.querySelector<HTMLElement>("h3");
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    });
  }
  function onIndicator(code: string, history = false) {
    if (!root.current || !Object.hasOwn(indicatorContent, code)) return;
    const card = Array.from(root.current.querySelectorAll<HTMLElement>("[data-financial-indicator]")).find(node => node.dataset.financialIndicator === code);
    if (!card) return;
    navigateReportSection(root.current, card.id);
    const button = card.querySelector<HTMLButtonElement>(`[data-financial-view="${history ? "history" : "methodology"}"]`);
    button?.click();
  }
  const renderedKysRequest = useRef<string | null>(null);
  useEffect(() => {
    const timing = state.kysTiming;
    if (!timing || state.kysBusy || state.metadataBusy || renderedKysRequest.current === timing.requestId) return;
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => {
      renderedKysRequest.current = timing.requestId;
      const totalMs = performance.now() - timing.startedAt;
      // After the committed report and two animation frames: includes the browser's paint opportunity.
      console.info(JSON.stringify({ event: "srm_kys_render_timing", requestId: timing.requestId, mode: timing.mode, outcome: state.kys.status, apiMs: timing.apiMs, totalMs, afterApiMs: totalMs - timing.apiMs, serverTiming: timing.serverTiming }));
    }); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [state.kysTiming, state.kysBusy, state.metadataBusy, state.kys.status]);
  if (!state.result) return null;
  if (state.result.entityType === "JDG" && inactiveSupplier(state.result)) return <div ref={root} className="supplier-report"><section className="report-identity"><p role="status">{inactiveJdgMessage(state.result.section.data)}</p></section></div>;
  const supplier = state.result, metadata = state.metadata;
  const availability = reportAvailability(supplier.entityType === "COMPANY" ? supplier.card.general.data : null, financial);
  if (supplier.entityType === "COMPANY" && availability.code === "DEREGISTERED") return <div ref={root} className="supplier-report"><section className="report-identity"><ReportAvailabilityView availability={availability} /></section></div>;
  const context: SupplierReportContext = { availability, financialIndicatorsTarget, supplier, metadata, financial, kys: state.kys, scope, setScope, selectedPeriod, setPeriod, onSource, onIndicator, onNavigate, kysOverview: kysOverviewModel, onKysDetails, periods,
    metadataBusy: state.metadataBusy, metadataError: state.metadataError };
  const scanner = slots.scanner?.(context);
  const summary = scanner || availability.code !== "AVAILABLE" ? null : slots.summary?.(context), observations = availability.hideDetails ? null : slots.observations?.(context), kysOverview = availability.hideDetails ? null : slots.kys?.(context);
  const areas = availability.code !== "AVAILABLE" ? [] : Object.entries(financialAreas).map(([key, title]) => ({ key, title, content: slots.financial?.[key as keyof typeof financialAreas]?.(context) })).filter(area => area.content != null && area.content !== false);
  const navigation = [{ id: summary ? "report-summary" : "supplier-identity", label: "Podsumowanie" },
    ...(scanner || areas.length || (supplier.entityType === "COMPANY" && availability.code === "AVAILABLE") ? [{ id: scanner || areas.length ? "report-finance" : "report-financial-details", label: "Finanse" }] : []),
    ...(observations ? [{ id: "report-observations", label: "Obserwacje" }] : []),
    { id: "report-details", label: "Dane szczegółowe" }, { id: "report-kys", label: "KYS" }];
  const primaryPkd = supplier.entityType === "COMPANY" ? supplier.card.general.data : null;
  const name = supplier.entityType === "JDG" ? supplier.section.data?.entries[0]?.name : supplier.card.general.data?.legalName ?? supplier.card.identity.name;
  return <ReportContext.Provider value={context}><div ref={root} className="supplier-report">
    <section id="supplier-identity" className="report-identity" aria-labelledby="supplier-identity-title">
      <CanonElement as="div" canonId="SRM-C53" usage="supplier-report:02" className="report-identity-heading"><ReportWebIdentity key={`${supplier.entityType}:${supplierNip(supplier)}`} nip={supplierNip(supplier) ?? ""} entityType={supplier.entityType} name={name ?? "Dostawca"}><div>{!scanner && <p className="report-eyebrow">Raport dostawcy</p>}<h2 id="supplier-identity-title" tabIndex={-1}>{name ?? "Nazwa niedostępna"}</h2>
        <div className="srm-supplier-meta-row"><p>NIP: {supplierNip(supplier)} · {supplier.entityType === "JDG" ? "Jednoosobowa działalność gospodarcza" : `KRS: ${supplier.card.identity.krs ?? "nie ustalono"}`}{primaryPkd?.mainPkd && <> · <span className="report-primary-pkd">PKD {primaryPkd.mainPkd}{primaryPkd.mainPkdDescription ? ` — ${primaryPkd.mainPkdDescription}` : ""}</span></>}</p>{supplier.entityType==='COMPANY' && state.metadata?.locationSubject && state.metadata.preferenceScope && <SupplierLocations
        key={state.metadata.preferenceScope+':'+state.metadata.locationSubject.supplierId} supplierId={state.metadata.locationSubject.supplierId} supplierName={name ?? "Dostawca"}
        refreshKey={[supplier.card.general.retrievedAt,state.kys?.retrievedAt,state.metadata.kys.lastAttemptAt].join(':')} />}</div></div></ReportWebIdentity>
        {!scanner && availability.code === "AVAILABLE" && selectedPeriod && <p className="report-period-label">Okres finansowy: <strong>{selectedPeriod.from} – {selectedPeriod.to}</strong><span>{scope === "standalone" ? "Jednostkowe" : "Skonsolidowane"}</span></p>}
      </CanonElement>
      {primaryPkd?.registryHistory && primaryPkd.registryHistory.members.length>1 && <p className="report-metadata-note" data-company-continuity="true">Firma kontynuuje działalność po przekształceniu. Aktualny KRS: {primaryPkd.registryHistory.currentKrs}. Historia finansowa obejmuje potwierdzonych poprzedników, z oznaczeniem podmiotu składającego sprawozdanie.</p>}

    </section>
    {!scanner && !availability.hideDetails && <ReportNavigation root={root} items={navigation} />}
    {scanner && <section id="report-finance" className="report-content-section report-scanner" aria-labelledby="scanner-title">{scanner}{availability.code === "AVAILABLE" && <FinancialLimitations state={state} onReadMetadata={onReadMetadata} />}</section>}
    {!scanner && availability.code !== "AVAILABLE" && <div className="srm-ui"><ReportAvailabilityView availability={availability} /></div>}
    {summary && <section id="report-summary" className="report-content-section" aria-labelledby="report-summary-title"><h2 id="report-summary-title" tabIndex={-1}>Najważniejsze informacje</h2>{summary}</section>}
    {!scanner && !!areas.length && <section id="report-finance" className="report-content-section" aria-labelledby="report-finance-title"><h2 id="report-finance-title" tabIndex={-1}>Kondycja finansowa</h2>
      <p className="health-dashboard-note">Zapisane wyniki finansowe. Istotność wskaźnika nie jest oceną ryzyka; kierunek zmiany nie oznacza poprawy ani pogorszenia kondycji.</p>
      {selectionPeriods.length > 0 && <div className="health-context-controls">
        <div className="health-scope-controls" role="group" aria-label="Zakres dashboardu">{(["standalone", "consolidated"] as const).filter(choice => financialPeriodsByScope(financial?.data, choice).length).map(choice => <CanonButton canonId="SRM-C02" usage="supplier-report:03" key={choice} type="button" aria-pressed={scope === choice} onClick={() => setScope(choice)}>{choice === "standalone" ? "Jednostkowe" : "Skonsolidowane"}</CanonButton>)}</div>
        <FinancialPeriodSelector periods={selectionPeriods} selected={selectedPeriod} onSelect={setPeriod} />
      </div>}
      <FinancialLimitations state={state} onReadMetadata={onReadMetadata} />
      <div className="report-financial-areas">{areas.map(area => <section key={area.key} aria-label={area.title}><h3 className="health-area-heading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={area.key === "liquidity" ? "M4 8h16v12H4z M8 8V4h8v4 M4 12h16 M10 15h4" : area.key === "debt" ? "M3 9l9-6 9 6H3z M5 11v8 M10 11v8 M15 11v8 M20 11v8 M3 21h18" : area.key === "profitability" ? "M4 3v17h17 M7 15l5-5 4 3 5-8 M17 5h4v4" : "M3 7h18v12H3z M3 11h18 M15 15h3 M6 7V4h12"} /></svg>{area.title}</h3>{area.content}</section>)}</div></section>}
    {observations && <section id="report-observations" className="report-content-section" aria-labelledby="report-observations-title"><h2 id="report-observations-title" tabIndex={-1}>Obserwacje i kwestie do sprawdzenia</h2>{observations}</section>}
    {!availability.hideDetails && <section id="report-details" className="report-details" aria-labelledby="report-details-title">
      <div className="report-details-heading"><h2 id="report-details-title" tabIndex={-1}>Dane szczegółowe</h2></div>
      <details className="report-detail" id="report-registry-details"><CanonSummary canonId="SRM-C49" usage="supplier-report:04">Dane identyfikacyjne i rejestrowe</CanonSummary><div className="report-detail-body">
        {supplier.entityType === "JDG" ? <JdgRegistryMount section={supplier.section} /> : <GeneralCompanyDataMount section={supplier.card.general} />}
        {primaryPkd?.registryHistory && primaryPkd.registryHistory.members.length>1 && <section aria-label="Historia przekształceń"><h3>Historia przekształceń</h3><ol>{[...primaryPkd.registryHistory.members].reverse().map(member=><li key={member.krs}><strong>{member.legalName ?? member.legalForm ?? 'Podmiot historyczny'}</strong> · KRS {member.krs}{member.registeredAt ? ` · wpis od ${member.registeredAt}`:''}{member.krs===primaryPkd.registryHistory!.currentKrs ? ' · aktualny podmiot' : ` · poprzednik${member.deregisteredAt ? `, wykreślony ${member.deregisteredAt}`:''}`}</li>)}</ol></section>}
      </div></details>
      {scanner && availability.code === "AVAILABLE" && <details className="report-detail" id="report-indicator-details"><CanonSummary canonId="SRM-C49" usage="supplier-report:05">Wskaźniki finansowe</CanonSummary><div className="report-detail-body" ref={setFinancialIndicatorsTarget} /></details>}
      {supplier.entityType === "COMPANY" && availability.code === "AVAILABLE" && <details className="report-detail" id="report-financial-details"><CanonSummary canonId="SRM-C49" usage="supplier-report:06">Sprawozdania finansowe i wskaźniki</CanonSummary><div className="report-detail-body">
        {!scanner && !areas.length && <FinancialLimitations state={state} onReadMetadata={onReadMetadata} />}
        <FinancialDataMount section={supplier.card.financial} onDownloadExcel={onDownloadExcel} selectedScope={scope} onScopeChange={setScope} selectedPeriod={selectedPeriod} />
      </div></details>}
      <details className="report-detail" id="report-kys"><CanonSummary canonId="SRM-C49" usage="supplier-report:kys-disclosure">Raport KYS</CanonSummary><div className="report-detail-body">
    <div className="srm-ui srm-kys-scope"><CanonElement as="section" canonId="SRM-C56" usage="supplier-report:kys" className="report-content-section srm-kys" aria-labelledby="report-kys-title">
      <div className="srm-kys-heading"><h2 id="report-kys-title" tabIndex={-1}>Raport KYS</h2><div className="srm-kys-downloads">
      {kysOverviewModel.available && metadata?.kys.exportRef && metadata.kys.freshness.retrievedAt && onDownloadKysPdf && <KysPdfButton
        key={`${supplierNip(supplier)}:${supplier.entityType}:${metadata.kys.exportRef}`}
        selection={{ nip: supplierNip(supplier) ?? "", entityType: supplier.entityType, retrievedAt: metadata.kys.freshness.retrievedAt, exportRef: metadata.kys.exportRef }}
        onDownload={onDownloadKysPdf} />}
      {supplier.entityType === "COMPANY" && kysOverviewModel.available && metadata?.kys.exportRef && metadata.kys.freshness.retrievedAt &&
        /^\d{10}$/.test(state.kys.data?.company?.krs ?? "") && /^\d{9}$/.test(state.kys.data?.company?.regon ?? "") &&
        /^[A-Za-z0-9_-]{8,100}$/.test(state.kys.data?.correlationId ?? "") && onDownloadKrsPdf && <KysKrsButton
        key={`krs:${supplierNip(supplier)}:${metadata.kys.exportRef}`}
        selection={{ nip: supplierNip(supplier) ?? "", entityType: "COMPANY", retrievedAt: metadata.kys.freshness.retrievedAt, exportRef: metadata.kys.exportRef }}
        onDownload={onDownloadKrsPdf} />}
        {kysOverviewModel.available ? <CanonButton canonId="SRM-C02" usage="supplier-report:07" className="srm-kys-refresh" type="button" onClick={onFetchKys} disabled={state.kysBusy || (supplier.entityType === "JDG" && !supplier.section.data?.entries.length)}>
          <KysIcon kind="refresh" />{state.kysBusy ? "Przygotowywanie raportu KYS…" : state.kys.status === "NOT_REQUESTED" ? "Pobierz raport KYS" : "Pobierz ponownie"}
        </CanonButton> : <CanonButton canonId="SRM-C01" usage="supplier-report:kys-request" type="button" onClick={onFetchKys} disabled={state.kysBusy || (supplier.entityType === "JDG" && !supplier.section.data?.entries.length)}><KysIcon kind="download" />{state.kysBusy ? "Przygotowywanie raportu KYS…" : "Pobierz raport KYS"}</CanonButton>}
      </div></div>
      <div className="srm-kys-report-meta">
        {kysOverviewModel.available && <span data-number-format="SRM-N15">Raport pobrano: {formatKysRetrievedAt(state.kysRequestedAt ?? null)
          ? <time dateTime={state.kysRequestedAt!} title="Czas wywołania raportu przez użytkownika · Europe/Warsaw">{formatKysRetrievedAt(state.kysRequestedAt ?? null)}</time> : "nie ustalono"}</span>}

      </div>
      {state.kysError && <p role="alert" className="search-error">{reportMessage(state.kysError)}</p>}
      {metadata?.kys.freshness.freshness === "EXPIRED" && <p className="health-data-note">Poprzedni raport KYS stracił ważność. Pobranie wymaga osobnego działania.</p>}
      {(state.kys.status === "PARTIAL" || metadata?.kys.completeness === "PARTIAL") && <p className="health-data-note">Raport KYS jest częściowy. Nie wszystkie sprawdzenia zwróciły dane.</p>}
      {kysOverviewModel.available && !metadata?.kys.exportRef && <p role="status">Nie potwierdzono wersji do eksportu PDF. Szczegóły raportu pozostają dostępne.</p>}
      <div id="report-kys-details">
        {state.kys.status === "NOT_REQUESTED" ? null
          : state.kys.data && !kysOverviewModel.available ? <p role="status">{state.kysBusy || state.metadataBusy ? "Sprawdzanie dostępności raportu…" : kysOverviewModel.message}</p>
          : <VerclyKysMount key={`${supplierNip(supplier)}:${state.kys.retrievedAt}`} section={state.kys} entityType={supplier.entityType} onRevealPesel={onRevealPesel} overview={kysOverview} />}
      </div>
    </CanonElement></div>
      </div></details>
    </section>}
  </div></ReportContext.Provider>;
}

function ReportWebIdentity({ nip, entityType, name, children }: {
  nip: string; entityType: "COMPANY" | "JDG"; name: string; children: ReactNode;
}) {
  const loader = useRef<{selection:string;load:ReturnType<typeof createSupplierWebRequest>} | null>(null);
  const load = useCallback(async (signal: AbortSignal): Promise<SupplierWebIdentityData> => {
    const selection = `${entityType}:${nip}`;
    if (loader.current?.selection !== selection) loader.current = {selection, load:createSupplierWebRequest(nip,entityType)};
    return loader.current.load(signal);
  }, [nip, entityType]);
  return <SupplierWebIdentity name={name} load={load}>{children}</SupplierWebIdentity>;
}
