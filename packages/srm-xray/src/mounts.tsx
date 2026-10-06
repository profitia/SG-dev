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

function warningLabel(code: string): string {
  if (code.startsWith("VERCLY_SEVERITY_")) return "Vercly zgłosiło uwagę do raportu.";
  if (code === "VERCLY_INCOMPLETE_SOURCES") return "Część źródeł nie zwróciła danych.";
  if (code === "IDENTIFIER_MISMATCH") return "Dane identyfikacyjne nie zgadzają się z zapytaniem.";
  return "Źródło nie zwróciło pełnych danych.";
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
      {section.warnings.map((warning, index) => <p className="xray-warning" key={index}>{section.source.provider === "VERCLY" ? warningLabel(warning) : warning}</p>)}
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
  const company = data?.company;
  const countLabel = (count: number | null | undefined) => count == null ? "brak danych" : `${count} wpisów w raporcie`;
  const lists = data?.screenedLists ?? [];
  return (
    <SectionFrame title="Raport KYS" section={section}>
      <div className="kys-report">
        <div className="kys-summary">
          <strong>{value(company?.name)}</strong>
          <span>Poziom ryzyka: {value(data?.riskLevel)}</span>
          <span>Sankcje: {lists.some((entry) => entry.type.toUpperCase() === "SANCTIONS" && entry.matched) ? "trafienie na liście" : lists.some((entry) => entry.type.toUpperCase() === "SANCTIONS") ? "brak trafienia w sprawdzonych listach" : "brak danych"}</span>
          <span>Stan raportu: {data?.isComplete ? "zakończony" : "w toku"}</span>
        </div>
        <div className="kys-grid">
          <section className="kys-panel" aria-label="Dane rejestrowe Vercly">
            <h3>Dane rejestrowe</h3>
            <dl className="xray-facts">
              <dt>Nazwa</dt><dd>{value(company?.name)}</dd>
              <dt>KRS</dt><dd>{value(company?.krs)}</dd>
              <dt>NIP</dt><dd>{value(company?.nip)}</dd>
              <dt>REGON</dt><dd>{value(company?.regon)}</dd>
              <dt>Forma prawna</dt><dd>{value(company?.legalForm)}</dd>
              <dt>Adres</dt><dd>{value(company?.address)}</dd>
              <dt>Kraj</dt><dd>{value(company?.country)}</dd>
              <dt>Status działalności</dt><dd>{value(company?.activityStatus)}</dd>
              <dt>Data wpisu</dt><dd>{value(company?.registeredAt)}</dd>
              <dt>Ostatnia zmiana</dt><dd>{value(company?.lastChangedAt)}</dd>
              <dt>PKD</dt><dd>{value(company?.mainPkd)}</dd>
              <dt>Kapitał zakładowy</dt><dd>{value(company?.shareCapital)}</dd>
              <dt>Zasady reprezentacji</dt><dd>{value(company?.representation)}</dd>
            </dl>
          </section>
          <section className="kys-panel" aria-label="Rejestry i statusy">
            <h3>Rejestry i statusy</h3>
            <dl className="xray-facts">
              <dt>Odpytane rejestry</dt><dd>{data?.queriedRegisters.length ? data.queriedRegisters.join(", ") : "brak danych"}</dd>
              <dt>Zaległości podatkowe</dt><dd>brak danych</dd>
              <dt>Postępowanie komornicze</dt><dd>brak danych</dd>
              <dt>Kurator</dt><dd>brak danych</dd>
              <dt>Likwidacja / zawieszenie</dt><dd>brak danych</dd>
              <dt>Upadłość / restrukturyzacja</dt><dd>brak danych</dd>
              <dt>Status VAT / VIES</dt><dd>brak danych</dd>
            </dl>
          </section>
        </div>
        <div className="kys-grid">
          <section className="kys-panel" aria-label="Osoby i beneficjenci">
            <h3>Osoby i beneficjenci</h3>
            <dl className="xray-facts">
              <dt>Reprezentanci i osoby powiązane</dt><dd>{countLabel(data?.relatedPersonsCount)}</dd>
              <dt>Beneficjenci rzeczywiści</dt><dd>{countLabel(data?.beneficialOwnersCount)}</dd>
              <dt>Pozycje PEP</dt><dd>{countLabel(data?.pepPositionsCount)}</dd>
            </dl>
            <p className="kys-note">Dane osobowe i identyfikatory osób nie są przechowywane w tej wersji karty.</p>
          </section>
          <section className="kys-panel" aria-label="Listy sankcyjne i ostrzeżenia">
            <h3>Listy sankcyjne i ostrzeżenia</h3>
            {lists.length ? <table className="kys-lists"><thead><tr><th>Lista</th><th>Wynik</th></tr></thead><tbody>
              {lists.map((entry) => <tr key={`${entry.type}:${entry.name}`}><td>{entry.name.replaceAll("_", " ")}</td><td>{entry.matched ? "trafienie" : "brak trafienia"}</td></tr>)}
            </tbody></table> : <p>brak danych</p>}
          </section>
        </div>
        <p className="kys-note">Stan na dzień: {value(data?.stateAsOf)} · ID raportu: {value(data?.reportId)} · identyfikator zapytania: {value(data?.correlationId)}. Brak wpisów w raporcie nie przesądza o stanie rejestru, którego Vercly nie odpytał.</p>
      </div>
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
