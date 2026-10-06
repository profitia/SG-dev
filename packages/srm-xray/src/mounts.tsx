import React, { type ReactNode } from "react";
import type {
  FinancialData,
  GeneralCompanyData,
  SectionEnvelope,
  SectionStatus,
  SupplierXRayCard,
  VerclyKysData,
} from "./contracts";
import { FinancialDashboard } from "./financial-dashboard";

type DisplaySection<T> = Omit<SectionEnvelope<T>, "source">;

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
  if (code === "FINANCIAL_NO_STRUCTURED_DATA") return "Nie mamy obecnie kwot finansowych do wyświetlenia dla tej firmy.";
  if (code === "FINANCIAL_INTERNATIONAL_STANDARD_UNAVAILABLE") return "Sprawozdanie finansowe jest dostępne, ale w obecnym zakresie danych nie możemy pokazać jego kwot. Sporządzono je według międzynarodowych standardów rachunkowości.";
  if (code === "FINANCIAL_COST_SIGN_UNVERIFIED") return "Nie udało się potwierdzić znaku części kosztów na podstawie wyniku ze sprzedaży. Pokazujemy wartości źródłowe; nie używaj ich do porównań bez sprawdzenia sprawozdania.";
  if (code === "KYS_PROVIDER_NOTICE") return "Raport KYS zawiera uwagę dotyczącą części sprawdzeń.";
  if (code === "KYS_INCOMPLETE_SOURCES") return "Nie wszystkie sprawdzane rejestry zwróciły dane.";
  if (code.startsWith("VERCLY_SEVERITY_")) return "Raport zawiera uwagę dostawcy danych.";
  if (code === "VERCLY_INCOMPLETE_SOURCES") return "Część źródeł nie zwróciła danych.";
  if (code === "IDENTIFIER_MISMATCH") return "Dane identyfikacyjne nie zgadzają się z zapytaniem.";
  return "Źródło nie zwróciło pełnych danych.";
}

const legalFormLabels: Record<string, string> = {
  JOINT_STOCK: "Spółka akcyjna",
  SIMPLE_JOINT_STOCK: "Prosta spółka akcyjna",
  LLC: "Spółka z ograniczoną odpowiedzialnością",
  LIMITED_LIABILITY: "Spółka z ograniczoną odpowiedzialnością",
  GENERAL_PARTNERSHIP: "Spółka jawna",
  LIMITED_PARTNERSHIP: "Spółka komandytowa",
  LIMITED_JOINT_STOCK_PARTNERSHIP: "Spółka komandytowo-akcyjna",
  PROFESSIONAL_PARTNERSHIP: "Spółka partnerska",
  CIVIL_PARTNERSHIP: "Spółka cywilna",
  SOLE_PROPRIETORSHIP: "Jednoosobowa działalność gospodarcza",
  COOPERATIVE: "Spółdzielnia",
  FOUNDATION: "Fundacja",
  ASSOCIATION: "Stowarzyszenie",
};
const activityStatusLabels: Record<string, string> = {
  ACTIVE: "Aktywny", INACTIVE: "Nieaktywny", SUSPENDED: "Zawieszony",
  CLOSED: "Zakończony", LIQUIDATION: "W likwidacji", BANKRUPT: "W upadłości",
  DISSOLVED: "Rozwiązany", DELETED: "Wykreślony",
};
const registerLabels: Record<string, string> = {
  "VAT Information Exchange System": "System wymiany informacji o VAT (VIES)",
  "National Debt Register": "Krajowy Rejestr Zadłużonych",
  "National Court Register": "Krajowy Rejestr Sądowy",
  "Business Register": "Rejestr przedsiębiorców",
};

function polishCode(input: string | null | undefined, labels: Record<string, string>): string {
  if (!input) return "nie ustalono";
  const code = input.trim().toUpperCase().replaceAll(/[^A-Z0-9]+/g, "_");
  return labels[code] ?? (/^[A-Z][A-Z0-9_]*$/.test(input) ? "nie ustalono" : input);
}

function yesNo(input: boolean | null | undefined): string {
  return input === true ? "Tak" : input === false ? "Nie" : "nie ustalono";
}

function capitalInThousands(input: string | null | undefined): string {
  if (!input) return "brak danych";
  const amount = Number(input.replaceAll(" ", "").replace(",", "."));
  return Number.isFinite(amount) ? `${new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount / 1000)} tys. PLN` : "brak danych";
}

const verclyListLabels: Record<string, string> = {
  pl_mswia_sanctions: "Lista osób i podmiotów objętych sankcjami (MSWiA)",
  eu_fsf_sanctions: "EU Consolidated Financial Sanctions List (DG FISMA)",
  pl_giif_sanctions: "Lista osób i podmiotów objętych szczególnymi środkami ograniczającymi (GIIF)",
  uk_ofsi_sanctions: "UK Office of Financial Sanctions Implementation (OFSI)",
  uk_fcdo_sanctions: "UK Sanctions List (FCDO)",
  us_ofac_sanctions: "US Specially Designated Nationals (SDN) List (OFAC)",
  us_ofac_non_sdn_sanctions: "US Consolidated (non-SDN) List (OFAC)",
  onz_sanctions: "UN Security Council Consolidated Sanctions (UNSC)",
  ua_government_sanctions: "Ukraine State Sanctions Registry (NSDC)",
  pl_knf_warnings: "Lista ostrzeżeń publicznych (KNF)",
  pl_uokik_payment_backlog: "Lista zatorów płatniczych (UOKiK)",
};

function SectionFrame({
  title,
  section,
  children,
}: {
  title: string;
  section: DisplaySection<unknown>;
  children: ReactNode;
}) {
  const missingFinancialReason = section.data == null && section.warnings.find((warning) => warning === "FINANCIAL_NO_STRUCTURED_DATA" || warning === "FINANCIAL_INTERNATIONAL_STANDARD_UNAVAILABLE");
  return (
    <section className="xray-section" aria-label={title}>
      <header className="xray-section-header">
        <h2>{title}</h2>
        <span>{statusLabel[section.status]}</span>
      </header>
      {section.status === "PENDING" ? <div role="status"><p>Raport jest przygotowywany. Poczekaj na wynik…</p>{title === "Raport KYS" && <div className="kys-progress" role="progressbar" aria-label="Postęp pobierania raportu KYS" aria-valuetext="Pobieranie trwa"><span /></div>}</div> : section.data == null ? <p>{missingFinancialReason ? warningLabel(missingFinancialReason) : "brak danych"}</p> : children}
      {section.warnings.filter((warning) => warning !== missingFinancialReason).map((warning, index) => <p className="xray-warning" key={index}>{warningLabel(warning)}</p>)}
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
        <dt>PKD</dt><dd>{value(data?.mainPkd)}</dd>
      </dl>
    </SectionFrame>
  );
}

export function FinancialDataMount({ section }: { section: DisplaySection<FinancialData> }) {
  return (
    <SectionFrame title="Dane finansowe" section={section}>
      {section.data ? <FinancialDashboard data={section.data} /> : <p>brak danych</p>}
    </SectionFrame>
  );
}

export function VerclyKysMount({ section, entityType = "COMPANY" }: { section: DisplaySection<VerclyKysData>; entityType?: "COMPANY" | "JDG" }) {
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
          <span>Sankcje: {yesNo(lists.some((entry) => entry.type.toUpperCase() === "SANCTIONS" && entry.matched) ? true : lists.some((entry) => entry.type.toUpperCase() === "SANCTIONS") ? false : null)}</span>
          <span>Stan raportu: {data?.isComplete ? "zakończony" : "w toku"}</span>
        </div>
        <div className="kys-grid">
          <section className="kys-panel" aria-label="Dane rejestrowe KYS">
            <h3>Dane rejestrowe</h3>
            <dl className="xray-facts">
              <dt>Nazwa</dt><dd>{value(company?.name)}</dd>
              {entityType === "COMPANY" && <><dt>KRS</dt><dd>{value(company?.krs)}</dd></>}
              <dt>NIP</dt><dd>{value(company?.nip)}</dd>
              <dt>REGON</dt><dd>{value(company?.regon)}</dd>
              <dt>Forma prawna</dt><dd>{polishCode(company?.legalForm, legalFormLabels)}</dd>
              <dt>Adres</dt><dd>{value(company?.address)}</dd>
              <dt>Kraj</dt><dd>{company?.country === "PL" ? "Polska" : value(company?.country)}</dd>
              <dt>Status działalności</dt><dd>{polishCode(company?.activityStatus, activityStatusLabels)}</dd>
              <dt>Data wpisu</dt><dd>{value(company?.registeredAt)}</dd>
              <dt>Ostatnia zmiana</dt><dd>{value(company?.lastChangedAt)}</dd>
              <dt>PKD</dt><dd>{value(company?.mainPkd)}</dd>
              {entityType === "COMPANY" && <><dt>Kapitał zakładowy</dt><dd>{capitalInThousands(company?.shareCapital)}</dd>
              <dt>Zasady reprezentacji</dt><dd>{value(company?.representation)}</dd></>}
            </dl>
          </section>
          <section className="kys-panel" aria-label="Rejestry i statusy">
            <h3>Rejestry i statusy</h3>
            <dl className="xray-facts">
              <dt>Odpytane rejestry</dt><dd>{data?.queriedRegisters.length ? data.queriedRegisters.map((name) => registerLabels[name] ?? name).join(", ") : "nie ustalono"}</dd>
              <dt>Wpis w Krajowym Rejestrze Zadłużonych</dt><dd>{yesNo(data?.registryChecks?.krzListed)}</dd>
              <dt>Podatnik VAT czynny</dt><dd>{yesNo(data?.registryChecks?.vatActive)}</dd>
              <dt>Podatnik VAT UE</dt><dd>{yesNo(data?.registryChecks?.euVat)}</dd>
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
              {lists.map((entry) => <tr key={`${entry.type}:${entry.name}`}><td>{verclyListLabels[entry.name] ?? entry.name.replaceAll("_", " ")}</td><td>{yesNo(entry.matched)}</td></tr>)}
            </tbody></table> : <p>brak danych</p>}
          </section>
        </div>
        <p className="kys-note">Stan na dzień: {value(data?.stateAsOf)} · ID raportu: {value(data?.reportId)} · identyfikator zapytania: {value(data?.correlationId)}. Brak wpisów w raporcie nie przesądza o stanie rejestru, który nie został sprawdzony.</p>
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
