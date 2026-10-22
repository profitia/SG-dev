"use client";
import { CanonLink, CanonButton, SupplierHeader, SupplierSearch } from '@profitia/srm-xray';

import "@profitia/srm-xray/financial-scanner.css";

import { ExecutiveSummary, FinancialScannerMount, KysOverview, type KysPdfSelection } from "@profitia/srm-xray";
import { useRef, useState } from "react";
import {createSupplierSearchGateway} from '../src/modules/xray/supplier-search-gateway';
import { SupplierReport, reportMessage, type SupplierReportSlots } from "../src/modules/xray/supplier-report";
import { useSupplierReport } from "../src/modules/xray/use-supplier-report";
import { supplierNip, inactiveSupplier } from "../src/modules/xray/report-controller";
import { SrmAuthenticatedView, SrmLogout, SrmSessionActions } from "./session-boundary";

const summarySlot: NonNullable<SupplierReportSlots["summary"]> = context => <ExecutiveSummary input={{
  nip: supplierNip(context.supplier) ?? "", entityType: context.supplier.entityType, metadata: context.metadata,
  scope: context.scope, selectedPeriod: context.selectedPeriod, loading: context.metadataBusy,
  kysStatus: context.kys.status, kysHasData: context.kysOverview.available,
}} onSource={context.onSource} onIndicator={context.onIndicator}
  onFinance={() => context.onNavigate("report-finance")}
  onDetails={() => context.onNavigate(context.supplier.entityType === "JDG" ? "report-registry-details" : "report-financial-details")} />;

const kysSlot: NonNullable<SupplierReportSlots["kys"]> = context => <KysOverview model={context.kysOverview} onDetails={context.onKysDetails} />;

const scannerSlot: NonNullable<SupplierReportSlots["scanner"]> = context => context.supplier.entityType === "COMPANY"
  ? <FinancialScannerMount selectedScope={context.scope} onScopeChange={context.setScope} key={supplierNip(context.supplier)} availability={context.availability} indicatorsTarget={context.financialIndicatorsTarget} report={context.metadata} loading={context.metadataBusy}
      assistant={{ nip: supplierNip(context.supplier) ?? undefined, name: context.supplier.card.general.data?.legalName ?? context.supplier.card.identity.name ?? "Dostawca",
        krs: context.supplier.card.identity.krs,
        avatars: { male: "/spendguru/assistant-male.png", anna: "/spendguru/assistant-female.png" } }} /> : null;

export default function Home() {
  return <SrmAuthenticatedView><SupplierReportHome /></SrmAuthenticatedView>;
}

function SupplierReportHome() {
  const { state, controller } = useSupplierReport();
  const [identifier, setIdentifier] = useState("");
  const [searchGateway] = useState(()=>createSupplierSearchGateway());
  const inputRef = useRef<HTMLInputElement>(null);
  const inactive = inactiveSupplier(state.result);
  const entry = !state.result;
  function newReport() { controller.reset(); setIdentifier(""); requestAnimationFrame(() => inputRef.current?.focus()); }

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

  async function downloadKysPdf(selection: KysPdfSelection, signal: AbortSignal): Promise<void> {
    const response = await fetch("/api/xray/kys/pdf", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selection), cache: "no-store", signal });
    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null);
      throw new Error(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? reportMessage(payload.error) : "Nie udało się przygotować PDF. Spróbuj ponownie.");
    }
    if (response.headers.get("Content-Type") !== "application/pdf") throw new Error("Nie udało się przygotować poprawnego PDF.");
    const blob = await response.blob();
    if (signal.aborted) return;
    const filename = response.headers.get("X-Download-Filename") ?? `KYS_${selection.nip}.pdf`;
    if (!/^KYS_[0-9]{10}(?:_[0-9-]{10})?\.pdf$/.test(filename)) throw new Error("Nieprawidłowa nazwa dokumentu.");
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function downloadKrsPdf(selection: KysPdfSelection, signal: AbortSignal): Promise<void> {
    const response = await fetch("/api/xray/kys/krs", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selection), cache: "no-store", signal });
    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null);
      throw new Error(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? reportMessage(payload.error) : "Nie udało się pobrać odpisu KRS.");
    }
    if (!response.headers.get("Content-Type")?.startsWith("application/pdf")) throw new Error("Dostawca nie zwrócił poprawnego pliku PDF.");
    const filename = response.headers.get("X-Download-Filename") ?? `KRS_${selection.nip}.pdf`;
    if (!/^KRS_[0-9]{10}(?:_[0-9-]{10})?\.pdf$/.test(filename)) throw new Error("Nieprawidłowa nazwa dokumentu.");
    const blob = await response.blob();
    if (signal.aborted) return;
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
    {!inactive && <CanonLink canonId="SRM-C55" usage="page:01" className="report-skip-link" href={entry ? "#supplier-search" : "#new-report"}>Przejdź do wyszukiwania</CanonLink>}
    <SupplierHeader>
      <SrmSessionActions legacyVisible={!entry}>
        <div className="appshield-actions">
          {!entry && <CanonButton canonId="SRM-C02" usage="page:04" id="new-report" type="button" className="appshield-new-report" onClick={newReport}>Nowy raport</CanonButton>}
          <SrmLogout legacyVisible={!inactive}><CanonButton canonId="SRM-C02" usage="page:05" type="submit" className="appshield-new-report">Wyloguj się</CanonButton></SrmLogout>
        </div>
      </SrmSessionActions>
    </SupplierHeader>
    {entry && <SupplierSearch nip={identifier} onNipChange={setIdentifier} inputRef={inputRef} busy={state.busy}
      onNipSearch={()=>void controller.search(identifier)} gateway={searchGateway} onNameSearch={selection=>void controller.searchKrs(selection)} />}
    <div className="appshield-content report-page">

      {state.busy && <p role="status" className="report-loading">Wyszukiwanie dostawcy. Poczekaj na wynik…</p>}
      {state.error && <p role="alert" className="search-error">{reportMessage(state.error)}</p>}
      {state.result && <SupplierReport key={`${state.result.entityType}:${supplierNip(state.result)}`} state={state}
        onFetchKys={controller.fetchKys} onReadMetadata={controller.refreshMetadata} onRevealPesel={revealPesel} onDownloadExcel={downloadFinancialExcel} onDownloadKysPdf={downloadKysPdf} onDownloadKrsPdf={downloadKrsPdf} slots={{ summary: summarySlot, scanner: scannerSlot, kys: kysSlot }} />}
    </div>
  </main>;
}
