"use client";

import { ExecutiveSummary, FinancialHealthArea } from "@profitia/srm-xray";
import { useRef, useState, type FormEvent } from "react";
import { SupplierReport, reportMessage, type SupplierReportContext, type SupplierReportSlots } from "../src/modules/xray/supplier-report";
import { useSupplierReport } from "../src/modules/xray/use-supplier-report";
import { supplierNip } from "../src/modules/xray/report-controller";

const summarySlot: NonNullable<SupplierReportSlots["summary"]> = context => <ExecutiveSummary input={{
  nip: supplierNip(context.supplier) ?? "", entityType: context.supplier.entityType, metadata: context.metadata,
  scope: context.scope, selectedPeriod: context.selectedPeriod, loading: context.metadataBusy,
  kysStatus: context.kys.status, kysHasData: !!context.kys.data,
}} onSource={context.onSource} onIndicator={context.onIndicator}
  onFinance={() => context.onNavigate("report-finance")}
  onDetails={() => context.onNavigate(context.supplier.entityType === "JDG" ? "report-registry-details" : "report-financial-details")} />;

const financialSlots: SupplierReportSlots["financial"] = Object.fromEntries((["liquidity", "debt", "profitability", "cashFlow"] as const).map(area => [area,
  (context: SupplierReportContext) => context.supplier.entityType === "COMPANY" ? <FinancialHealthArea area={area} financial={context.metadata?.financial ?? null}
    scope={context.scope} selectedPeriod={context.selectedPeriod} loading={context.metadataBusy} onSource={context.onSource} /> : null,
]));

export default function Home() {
  const { state, controller } = useSupplierReport();
  const [identifier, setIdentifier] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  function newReport() { controller.reset(); setIdentifier(""); inputRef.current?.focus(); }
  async function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await controller.search(identifier); }

  async function revealPesel(token: string): Promise<string> {
    const response = await fetch("/api/xray/kys/pesel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }), cache: "no-store",
    });
    if (!response.ok) throw new Error("PESEL reveal failed");
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("pesel" in payload) ||
      typeof payload.pesel !== "string" || !/^\d{11}$/.test(payload.pesel)) throw new Error("Invalid PESEL response");
    return payload.pesel;
  }

  async function downloadFinancialExcel(scope: "standalone" | "consolidated", years: string[]): Promise<void> {
    const nip = state.result?.entityType === "COMPANY" ? state.result.card.identity.nip : null;
    if (!nip) throw new Error("Brak numeru NIP spółki.");
    const response = await fetch("/api/xray/financial-excel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nip, scope, years }), cache: "no-store",
    });
    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null);
      throw new Error(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? reportMessage(payload.error) : "Nie udało się pobrać pliku Excel.");
    }
    const filename = response.headers.get("X-Download-Filename") ?? `Financials_${nip}.xlsx`;
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return <main className="appshield">
    <a className="report-skip-link" href="#supplier-search">Przejdź do wyszukiwania</a>
    <header className="appshield-header">
      <h1>SRM X-Ray</h1>
      <div className="appshield-actions">
        {(state.result || state.busy) && <button type="button" className="appshield-new-report" onClick={newReport}>Nowy raport</button>}
        <form action="/api/auth/logout" method="post"><button type="submit" className="appshield-new-report">Wyloguj się</button></form>
      </div>
    </header>
    <div className="appshield-content report-page">
      <form id="supplier-search" tabIndex={-1} className={`appshield-search ${state.result ? "appshield-search--compact" : ""}`} aria-label="Wyszukaj dostawcę" onSubmit={search}>
        <label htmlFor="identifier">Numer NIP dostawcy</label>
        <div className="appshield-search-fields">
          <input ref={inputRef} id="identifier" name="identifier" inputMode="numeric" pattern="[0-9]{10}" maxLength={14}
            placeholder="Wpisz numer NIP…" required value={identifier} aria-describedby="supplier-search-help" onChange={event => {
              controller.reset(); setIdentifier(event.target.value.replace(/[\s-]/g, ""));
            }} />
          <button type="submit" disabled={state.busy}>{state.busy ? "Wyszukiwanie…" : "Wyszukaj dostawcę"}</button>
        </div>
        <small id="supplier-search-help">Dane finansowe i rejestrowe są pobierane przy wyszukiwaniu. Raport KYS zamawiasz osobno.</small>
      </form>
      {state.busy && <p role="status" className="report-loading">Wyszukiwanie dostawcy. Poczekaj na wynik…</p>}
      {state.error && <p role="alert" className="search-error">{reportMessage(state.error)}</p>}
      {!state.result && !state.busy && !state.error && <div className="report-empty"><h2>Raport dostawcy</h2><p>Wpisz NIP, aby zobaczyć dostępne dane finansowe i rejestrowe.</p></div>}
      {state.result && <SupplierReport key={`${state.result.entityType}:${supplierNip(state.result)}`} state={state}
        onFetchKys={controller.fetchKys} onReadMetadata={controller.refreshMetadata} onRevealPesel={revealPesel} onDownloadExcel={downloadFinancialExcel} slots={{ summary: summarySlot, financial: financialSlots }} />}
    </div>
  </main>;
}
