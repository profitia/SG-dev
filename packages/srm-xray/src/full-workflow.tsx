"use client";
import React,{useRef,useState,useEffect,useLayoutEffect,type ReactNode} from 'react';
import {CanonLink,CanonButton,SupplierHeader,SupplierSearch,type SupplierSearchGateway,type KysPdfSelection} from './index';
import {XRayLocaleProvider} from './i18n';
import {useWorkflowRenderTiming} from './workflow-render-timing';
import {XRAY_LOGO_DATA_URL} from './presentation-assets';
import {FullSupplierReport,fullReportSlots,reportMessage} from './full-report';
import {useSupplierReport} from './workflow';
import {supplierNip,inactiveSupplier} from './workflow-controller';
export type FullXRayWorkflowProps={locale?:'pl'|'en';transport:typeof fetch;searchGateway:SupplierSearchGateway;active?:boolean;observeWorkflowTiming?:boolean;assistantHost?:ReactNode;onAssistantContext?:(context:import("./assistant-context").AssistantApplicationContext|null)=>void;mapRuntimeOrigin?:string;loadMap?:()=>Promise<import('./supplier-locations-view').SupplierMapMount>;assistantAvatars?:{male:string;anna:string};
  ReportComponent?:typeof FullSupplierReport;sessionActions?:(controls:ReactNode,entry:boolean,inactive:boolean)=>ReactNode;onReturn?:()=>void};
/** Full product UI shared by both hosts. Every external action uses its host's
 * authenticated transport; local charts never fetch a provider. */
export function FullXRayWorkflow(props:FullXRayWorkflowProps){return <XRayLocaleProvider locale={props.locale??"pl"}><FullWorkflow {...props}/></XRayLocaleProvider>}
function FullWorkflow({transport,searchGateway,active=true,observeWorkflowTiming=false,assistantHost,onAssistantContext,mapRuntimeOrigin,loadMap,assistantAvatars,ReportComponent=FullSupplierReport,sessionActions,onReturn}:FullXRayWorkflowProps){
  const {state,controller}=useSupplierReport(transport);
  const beginSearchTiming=useWorkflowRenderTiming(state,active&&observeWorkflowTiming);
  const [identifier,setIdentifier]=useState('');
  const inputRef=useRef<HTMLInputElement>(null);
  const inactive=inactiveSupplier(state.result),entry=!state.result;
  useEffect(()=>{if(!active)controller.suspend()},[active,controller]);
  useLayoutEffect(()=>{controller.expirePrivate()},[active,controller,state.kys]);
  useEffect(()=>{if(!active)return;const timer=setInterval(controller.expirePrivate,1000);return()=>clearInterval(timer)},[active,controller]);
  function newReport(){controller.reset();setIdentifier('');requestAnimationFrame(()=>inputRef.current?.focus())}
  const controls=<div className="appshield-actions">{!entry&&<CanonButton canonId="SRM-C02" usage="page:04" id="new-report" type="button" className="appshield-new-report" onClick={newReport}>Nowy raport</CanonButton>}{onReturn&&<CanonButton canonId="SRM-C02" usage="full-workflow:return" type="button" className="appshield-new-report" onClick={onReturn}>Wróć do biurka</CanonButton>}</div>;
  async function revealPesel(token: string): Promise<string> {
    const response = await transport("/api/xray/kys/pesel", {
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
    const response = await transport("/api/xray/kys/pdf", { method: "POST", headers: { "Content-Type": "application/json" },
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
    const response = await transport("/api/xray/kys/krs", { method: "POST", headers: { "Content-Type": "application/json" },
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
    const response = await transport("/api/xray/financial-excel", {
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

  return <main className="appshield srm-xray-product">
    {!inactive && <CanonLink canonId="SRM-C55" usage="page:01" className="report-skip-link" href={entry ? "#supplier-search" : "#new-report"}>Przejdź do wyszukiwania</CanonLink>}
    <SupplierHeader logoSrc={XRAY_LOGO_DATA_URL}>
      {sessionActions ? sessionActions(controls,entry,inactive) : controls}
    </SupplierHeader>
    {entry && <SupplierSearch nip={identifier} onNipChange={setIdentifier} inputRef={inputRef} busy={state.busy}
      onNipSearch={()=>{if(observeWorkflowTiming)beginSearchTiming(identifier);void controller.search(identifier)}} gateway={searchGateway} onNameSearch={selection=>void controller.searchKrs(selection)} />}
    <div className="appshield-content report-page">

      {state.busy && <p role="status" className="report-loading">Wyszukiwanie dostawcy. Poczekaj na wynik…</p>}
      {state.error && <p role="alert" className="search-error">{reportMessage(state.error)}</p>}
      {state.result && <ReportComponent key={`${state.result.entityType}:${supplierNip(state.result)}`} state={state} locationTransport={transport}
        onFetchKys={controller.fetchKys} onReadMetadata={controller.refreshMetadata} onRevealPesel={revealPesel} onDownloadExcel={downloadFinancialExcel} onDownloadKysPdf={downloadKysPdf} onDownloadKrsPdf={downloadKrsPdf} slots={fullReportSlots(assistantAvatars,assistantHost,onAssistantContext)} mapRuntimeOrigin={mapRuntimeOrigin} loadMap={loadMap} />}
    </div>
  </main>;
}
