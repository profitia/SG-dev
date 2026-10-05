import type { ReactNode } from "react";
import type {
  FinancialData,
  GeneralCompanyData,
  SectionEnvelope,
  SectionStatus,
  SupplierXRayCard,
  VerclyKysData,
} from "./contracts";

const statusLabel: Record<SectionStatus, string> = {
  SUCCESS: "Dostępne",
  EMPTY: "Brak danych",
  PARTIAL: "Dane częściowe",
  ERROR: "Źródło niedostępne",
  NOT_REQUESTED: "Nie pobrano",
  PENDING: "Pobieranie",
};

function value(text: string | null | undefined): string {
  return text == null || text === "" ? "brak danych" : text;
}

function SectionFrame({
  title,
  section,
  children,
}: {
  title: string;
  section: SectionEnvelope<unknown>;
  children: ReactNode;
}) {
  return (
    <section className="xray-section" aria-label={title}>
      <header className="xray-section-header">
        <h2>{title}</h2>
        <span>{statusLabel[section.status]}</span>
      </header>
      <p className="xray-source">
        Źródło: {section.source.provider} · {section.source.model} · pobrano: {value(section.retrievedAt)}
      </p>
      {section.data == null ? <p>brak danych</p> : children}
      {section.warnings.map((warning, index) => <p className="xray-warning" key={index}>{warning}</p>)}
    </section>
  );
}

export function GeneralCompanyDataMount({ section }: { section: SectionEnvelope<GeneralCompanyData> }) {
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
        <dt>PKD</dt><dd>{value(data?.mainPkd)}</dd>
      </dl>
    </SectionFrame>
  );
}

export function FinancialDataMount({ section }: { section: SectionEnvelope<FinancialData> }) {
  return (
    <SectionFrame title="Dane finansowe" section={section}>
      {section.data?.periods.length ? section.data.periods.map((period) => (
        <div key={period.documentId} className="xray-period">
          <h3>{period.from} – {period.to} · {period.scope}</h3>
          <dl className="xray-facts">
            {period.facts.map((fact) => (
              <div key={fact.metricCode}>
                <dt>{fact.metricCode}</dt>
                <dd>{fact.amount} {fact.currency} · {fact.unit}</dd>
              </div>
            ))}
          </dl>
        </div>
      )) : <p>brak danych</p>}
    </SectionFrame>
  );
}

export function VerclyKysMount({ section }: { section: SectionEnvelope<VerclyKysData> }) {
  const data = section.data;
  return (
    <SectionFrame title="Raport KYS" section={section}>
      <dl className="xray-facts">
        <dt>Identyfikator raportu</dt><dd>{value(data?.reportId)}</dd>
        <dt>Stan na dzień</dt><dd>{value(data?.stateAsOf)}</dd>
        <dt>Rejestry</dt><dd>{data?.queriedRegisters.length ? data.queriedRegisters.join(", ") : "brak danych"}</dd>
      </dl>
    </SectionFrame>
  );
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
