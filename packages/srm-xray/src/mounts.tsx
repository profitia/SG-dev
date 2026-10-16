"use client";

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
  const missingFinancialReason = section.data == null && section.warnings.find((warning) => ["FINANCIAL_NO_STRUCTURED_DATA", "FINANCIAL_INTERNATIONAL_STANDARD_UNAVAILABLE", "FINANCIAL_NO_XML", "FINANCIAL_UNKNOWN_FORMAT", "FINANCIAL_UNSUPPORTED_XML"].includes(warning));
  return (
    <section className="xray-section" aria-label={title}>
      <header className={"xray-section-header" + (actions ? " has-actions" : "")}>
        <h2>{title}</h2>
        <div className="financial-section-actions"><span>{statusLabel[section.status]}</span>{actions && <div className="srm-ui financial-export-action">{actions}</div>}</div>
      </header>
      {section.status === "PENDING" ? <div role="status"><p>Raport jest przygotowywany. Poczekaj na wynik…</p>{title === "Raport KYS" && <div className="kys-progress" role="progressbar" aria-label="Postęp pobierania raportu KYS" aria-valuetext="Pobieranie trwa"><span /></div>}</div> : section.data == null ? <p>{missingFinancialReason ? warningLabel(missingFinancialReason) : "brak danych"}</p> : children}
      {section.warnings.filter((warning) => warning !== missingFinancialReason && warning !== "FINANCIAL_COST_SIGN_UNVERIFIED").map((warning, index) => <p className="xray-warning" key={index}>{warningLabel(warning)}</p>)}
    </section>
  );
}

export function GeneralCompanyDataMount({ section }: { section: DisplaySection<GeneralCompanyData> }) {
  const data = section.data;
  return (
    <SectionFrame title="Dane ogólne" section={section}>
      <dl className="xray-facts">
        <dt>Nazwa</dt><dd>{value(data?.legalName)}</dd>
        <dt>Forma prawna</dt><dd>{value(data?.legalForm)}</dd>
        <dt>KRS</dt><dd>{value(data?.krs)}</dd>
        <dt>NIP</dt><dd>{value(data?.nip)}</dd>
        <dt>REGON</dt><dd>{value(data?.regon)}</dd>
        <dt>Adres</dt><dd>{value(data?.registeredAddress)}</dd>
        <dt>Data rejestracji</dt><dd>{value(data?.registeredAt)}</dd>
        <dt>PKD</dt><dd>{value(data?.mainPkd)}{data?.mainPkd && data.mainPkdDescription ? ` — ${data.mainPkdDescription}` : ""}</dd>
      </dl>
    </SectionFrame>
  );
}

export function FinancialDataMount({ section, onDownloadExcel, selectedScope, onScopeChange, selectedPeriod }: { section: DisplaySection<FinancialData>; onDownloadExcel?: (scope: "standalone" | "consolidated", years: string[]) => Promise<void>;
  selectedScope?: FinancialPeriod["scope"] | null; onScopeChange?: (scope: FinancialPeriod["scope"]) => void; selectedPeriod?: FinancialPeriodSelection | null }) {
  const [exportOpen, setExportOpen] = useState(false);
  return (
    <SectionFrame title="Dane finansowe" section={section} actions={onDownloadExcel && section.data?.periods.some(period => period.facts.length) && <CanonButton canonId="SRM-C02" usage="FinancialDataMount:export" type="button" aria-haspopup="dialog" onClick={() => setExportOpen(true)}><KysIcon kind="download" />Pobierz do Excela</CanonButton>}>
      {section.data?.periods.filter(p => (!selectedScope || p.scope === selectedScope) && (!selectedPeriod || (p.from === selectedPeriod.from && p.to === selectedPeriod.to))).map(p => {
        const issues = financialQualityIssues(p), comparative = p.comparativeData;
        if (!issues.length && !comparative) return null;
        const display = (f: FinancialPeriod["facts"][number] | undefined) => f ? `${f.amount} ${f.unit === "UNKNOWN" ? "(jednostka niepotwierdzona)" : f.unit}` : "brak danych";
        return <div key={`${p.documentId}:${p.from}:${p.to}`} aria-label="Jakość danych finansowych">
          <p><strong>{p.from} – {p.to} · {p.scope === "standalone" ? "dane jednostkowe" : "dane skonsolidowane"}</strong></p>
          {issues.map(issue => <p key={issue}>{financialQualityLabels[issue]}</p>)}
          {comparative && <><p>Dane porównawcze: zachowano oddzielnie wartości zwykłe i przekształcone. {comparative.dateBasis === "UNCONFIRMED" ? "Okres danych przekształconych wymaga potwierdzenia." : "Dane porównawcze dotyczą poprzedniego roku kalendarzowego."}</p>
            <CanonElement as="table" canonId="SRM-C48" usage="FinancialDataMount:comparatives"><thead><tr><th>Pozycja</th><th>Dane zwykłe</th><th>Dane przekształcone</th></tr></thead><tbody>
              {[...new Set([...comparative.original, ...comparative.restated].map(f => f.metricCode))].map(code => <tr key={code}><th>{financialLabels[code]?.label ?? "Pozycja źródłowa"}</th><td>{display(comparative.original.find(f=>f.metricCode===code))}</td><td>{display(comparative.restated.find(f=>f.metricCode===code))}</td></tr>)}
            </tbody></CanonElement></>}
        </div>;
      })}
      {section.data ? <FinancialDashboard exportOpen={exportOpen} onCloseExport={() => setExportOpen(false)} data={section.data} onDownloadExcel={onDownloadExcel} selectedScope={selectedScope} onScopeChange={onScopeChange} selectedPeriod={selectedPeriod} /> : <p>brak danych</p>}
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
