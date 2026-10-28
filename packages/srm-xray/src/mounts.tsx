"use client";
import {useXRayText} from "./i18n";

import React, { useState, type ReactNode } from "react";
import type {
  FinancialData,
  FinancialPeriod,
  GeneralCompanyData,
  SectionEnvelope,
  SectionStatus,
  SupplierXRayCard,
} from "./contracts";
import { value, warningLabel } from "./kys-content";
import { FinancialDashboard, type FinancialPeriodSelection } from "./financial-dashboard";

import { CanonButton, CanonElement } from "./ui-canon";
import { financialQualityIssues, financialQualityLabels } from "./financial-quality";
import { financialLabels } from "./financial-labels";
import { KysIcon } from "./kys-report";
import { VerclyKysReport } from "./kys-report";

type DisplaySection<T> = Omit<SectionEnvelope<T>, "source">;

const statusLabel: Record<SectionStatus, string> = {
  SUCCESS: "Dostępne",
  EMPTY: "Brak danych",
  PARTIAL: "Dane częściowe",
  ERROR: "Źródło niedostępne",
  NOT_REQUESTED: "Nie pobrano",
  PENDING: "Pobieranie",
};


function SectionFrame({
  title,
  section,
  children,
  actions,
}: {
  title: string;
  section: DisplaySection<unknown>;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const t=useXRayText();
  const missingFinancialReason = section.data == null && section.warnings.find((warning) => ["FINANCIAL_NO_STRUCTURED_DATA", "FINANCIAL_INTERNATIONAL_STANDARD_UNAVAILABLE", "FINANCIAL_NO_XML", "FINANCIAL_UNKNOWN_FORMAT", "FINANCIAL_UNSUPPORTED_XML"].includes(warning));
  return (
    <section className="xray-section" aria-label={t(title)}>
      <header className={"xray-section-header" + (actions ? " has-actions" : "")}>
        <h2>{t(title)}</h2>
        <div className="financial-section-actions"><span>{t(statusLabel[section.status])}</span>{actions && <div className="srm-ui financial-export-action">{actions}</div>}</div>
      </header>
      {section.status === "PENDING" ? <div role="status"><p>{t("Raport jest przygotowywany. Poczekaj na wynik…")}</p>{title === "Raport KYS" && <div className="kys-progress" role="progressbar" aria-label={t("Postęp pobierania raportu KYS")} aria-valuetext={t("Pobieranie trwa")}><span /></div>}</div> : section.data == null ? <p>{t(missingFinancialReason ? warningLabel(missingFinancialReason) : "brak danych")}</p> : children}
      {section.warnings.filter((warning) => warning !== missingFinancialReason && warning !== "FINANCIAL_COST_SIGN_UNVERIFIED").map((warning, index) => <p className="xray-warning" key={index}>{t(warningLabel(warning))}</p>)}
    </section>
  );
}

export function GeneralCompanyDataMount({ section }: { section: DisplaySection<GeneralCompanyData> }) {
  const t=useXRayText();
  const data = section.data;
  const display=(input:string|null|undefined)=>input||t("brak danych");
  return (
    <SectionFrame title="Dane ogólne" section={section}>
      <dl className="xray-facts">
        <dt>{t("Nazwa")}</dt><dd>{display(data?.legalName)}</dd>
        <dt>{t("Forma prawna")}</dt><dd>{display(data?.legalForm)}</dd>
        <dt>{t("KRS")}</dt><dd>{display(data?.krs)}</dd>
        <dt>{t("NIP")}</dt><dd>{display(data?.nip)}</dd>
        <dt>{t("REGON")}</dt><dd>{display(data?.regon)}</dd>
        <dt>{t(data?.registrySource?.provider === "KRS" ? "Adres rejestrowy (KRS)" : "Adres")}</dt><dd>{display(data?.registeredAddress)}</dd>
        <dt>{t("Data rejestracji")}</dt><dd>{display(data?.registeredAt)}</dd>
        <dt>{t("PKD")}</dt><dd>{display(data?.mainPkd)}{data?.mainPkd && data.mainPkdDescription ? ` — ${data.mainPkdDescription}` : ""}</dd>
      </dl>
      {data?.registrySource?.provider === "KRS" && <p className="xray-source">{t("Źródło danych ogólnych: KRS · pobrano ")}<time dateTime={data.registrySource.retrievedAt}>{data.registrySource.retrievedAt}</time></p>}
    </SectionFrame>
  );
}

export function FinancialDataMount({ embedded, section, onDownloadExcel, selectedScope, onScopeChange, selectedPeriod }: { embedded?:boolean; section: DisplaySection<FinancialData>; onDownloadExcel?: (scope: "standalone" | "consolidated", years: string[]) => Promise<void>;
  selectedScope?: FinancialPeriod["scope"] | null; onScopeChange?: (scope: FinancialPeriod["scope"]) => void; selectedPeriod?: FinancialPeriodSelection | null }) {
  const t=useXRayText();
  const [exportOpen, setExportOpen] = useState(false);
  return (
    <SectionFrame title="Dane finansowe" section={section} actions={onDownloadExcel && section.data?.periods.some(period => period.facts.length) && <CanonButton canonId="SRM-C02" usage="FinancialDataMount:export" type="button" aria-haspopup="dialog" onClick={() => setExportOpen(true)}><KysIcon kind="download" />{t("Pobierz do Excela")}</CanonButton>}>
      {section.data?.periods.filter(p => (!selectedScope || p.scope === selectedScope) && (!selectedPeriod || (p.from === selectedPeriod.from && p.to === selectedPeriod.to))).map(p => {
        const issues = financialQualityIssues(p), comparative = p.comparativeData;
        if (!issues.length && !comparative) return null;
        const display = (f: FinancialPeriod["facts"][number] | undefined) => f ? `${f.amount} ${f.unit === "UNKNOWN" ? t("(jednostka niepotwierdzona)") : f.unit}` : "brak danych";
        return <div key={`${p.documentId}:${p.from}:${p.to}`} aria-label={t("Jakość danych finansowych")}>
          <p><strong>{p.from}{t(" – ")}{p.to}{t(" · ")}{t(p.scope === "standalone" ? "dane jednostkowe" : "dane skonsolidowane")}</strong></p>
          {issues.map(issue => <p key={issue}>{t(financialQualityLabels[issue])}</p>)}
          {comparative && <><p>{t("Dane porównawcze: zachowano oddzielnie wartości zwykłe i przekształcone. ")}{t(comparative.dateBasis === "UNCONFIRMED" ? "Okres danych przekształconych wymaga potwierdzenia." : "Dane porównawcze dotyczą poprzedniego roku kalendarzowego.")}</p>
            <CanonElement as="table" canonId="SRM-C48" usage="FinancialDataMount:comparatives"><thead><tr><th>{t("Pozycja")}</th><th>{t("Dane zwykłe")}</th><th>{t("Dane przekształcone")}</th></tr></thead><tbody>
              {[...new Set([...comparative.original, ...comparative.restated].map(f => f.metricCode))].map(code => <tr key={code}><th>{financialLabels[code]?.label ?? "Pozycja źródłowa"}</th><td>{display(comparative.original.find(f=>f.metricCode===code))}</td><td>{display(comparative.restated.find(f=>f.metricCode===code))}</td></tr>)}
            </tbody></CanonElement></>}
        </div>;
      })}
      {section.data ? <FinancialDashboard embedded={embedded} exportOpen={exportOpen} onCloseExport={() => setExportOpen(false)} data={section.data} onDownloadExcel={onDownloadExcel} selectedScope={selectedScope} onScopeChange={onScopeChange} selectedPeriod={selectedPeriod} /> : <p>{t("brak danych")}</p>}
    </SectionFrame>
  );
}

/** The provider state date is a calendar date, never the render or download time. */
export function kysStateDate(stateAsOf: string | null | undefined): string {
  const match = stateAsOf?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/);
  if (!match || (stateAsOf?.includes("T") && (!Number.isFinite(Date.parse(stateAsOf)) || Number(stateAsOf.slice(11, 13)) > 23))) return "Stan danych: nie ustalono";
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(0); date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "Stan danych: nie ustalono";
  return `Stan na dzień ${match[3]}.${match[2]}.${match[1]}`;
}

export function VerclyKysMount(props: React.ComponentProps<typeof VerclyKysReport>) {
  return <VerclyKysReport {...props} />;
}

export function SupplierXRayMount({ card }: { card: SupplierXRayCard }) {
  return (
    <div className="xray-card">
      <GeneralCompanyDataMount section={card.general} />
      <FinancialDataMount section={card.financial} />
      <VerclyKysMount section={card.kys} />
    </div>
  );
}
