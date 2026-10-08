"use client";

import React, { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  FinancialData,
  FinancialPeriod,
  GeneralCompanyData,
  SectionEnvelope,
  SectionStatus,
  SupplierXRayCard,
  VerclyKysData,
  VerclyPerson,
} from "./contracts";
import { FinancialDashboard, type FinancialPeriodSelection } from "./financial-dashboard";

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

function pepMatchCount(count: number): string {
  const form = new Intl.PluralRules("pl-PL").select(count);
  return `${count} ${form === "one" ? "dopasowanie" : form === "few" ? "dopasowania" : "dopasowań"} w raporcie`;
}

function warningLabel(code: string): string {
  if (code === "FINANCIAL_NO_STRUCTURED_DATA") return "Nie mamy obecnie kwot finansowych do wyświetlenia dla tej firmy.";
  if (code === "FINANCIAL_INTERNATIONAL_STANDARD_UNAVAILABLE") return "Sprawozdanie finansowe jest dostępne, ale w obecnym zakresie danych nie możemy pokazać jego kwot. Sporządzono je według międzynarodowych standardów rachunkowości.";
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

function PeselReveal({ token, onReveal }: { token: string | null | undefined; onReveal?: (token: string) => Promise<string> }) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const currentToken = useRef(token);
  currentToken.current = token;
  useEffect(() => { setRevealed(null); setError(false); }, [token]);
  useEffect(() => {
    if (!revealed) return;
    const timer = window.setTimeout(() => setRevealed(null), 60_000);
    const hideWhenNotVisible = () => { if (document.hidden) setRevealed(null); };
    const hideWhenUnfocused = () => setRevealed(null);
    document.addEventListener("visibilitychange", hideWhenNotVisible);
    window.addEventListener("blur", hideWhenUnfocused);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", hideWhenNotVisible);
      window.removeEventListener("blur", hideWhenUnfocused);
    };
  }, [revealed]);
  return <span className="kys-person-id">
    {revealed ? <span>{revealed}</span> : token ? <span className="kys-pesel-mask" aria-label="Numer ukryty">•••••••••••</span> : "brak danych"}
    {token && onReveal && <button type="button" className="kys-pesel-button" disabled={busy} onClick={async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (revealed) { setRevealed(null); return; }
      setBusy(true);
      setError(false);
      try {
        const pesel = await onReveal(token);
        if (currentToken.current === token && !document.hidden && document.hasFocus() && /^\d{11}$/.test(pesel)) setRevealed(pesel);
        else if (currentToken.current === token) setError(true);
      } catch { if (currentToken.current === token) setError(true); }
      finally { if (currentToken.current === token) setBusy(false); }
    }}>{busy ? "Pobieranie…" : revealed ? "Ukryj" : "Pokaż"}</button>}
    {error && <span className="kys-pesel-error" role="alert">Nie udało się ujawnić numeru.</span>}
  </span>;
}

function KysPeopleTable({ people, onRevealPesel, showBirthDate = true, kind = "manager" }: {
  people: readonly VerclyPerson[] | undefined;
  onRevealPesel?: (token: string) => Promise<string>;
  showBirthDate?: boolean;
  kind?: "manager" | "beneficiary";
}) {
  if (!people?.length) return <p>brak danych</p>;
  return <div className="kys-person-scroll"><div className={`kys-person-list kys-person-list--${kind}`}>
    <div className="kys-person-columns">
      <span>Imię i nazwisko</span><span>Rola / funkcja</span>
      {kind === "beneficiary" && <span>Powiązanie / rejestr</span>}
      <span>PESEL</span><span>Sankcje</span><span>PEP</span><span aria-hidden="true" />
    </div>
    {people.map((person, index) => {
    const position = person.positions.join(", ");
    const foundIn = person.foundIn.join(", ");
    const preview = [position, foundIn].filter(Boolean).join(" · ");
    return <details className="kys-person-entry" key={`${person.fullName}:${index}`}>
      <summary className="kys-person-summary">
        <strong className="kys-person-name">{person.fullName}</strong>
        <span className="kys-person-preview">{kind === "beneficiary" ? position || "brak danych" : preview || "brak danych"}</span>
        {kind === "beneficiary" && <span className="kys-person-preview">{foundIn || "brak danych"}</span>}
        <PeselReveal token={person.peselRevealToken} onReveal={onRevealPesel} />
        <span className="kys-person-status">{yesNo(person.sanctionsMatch)}</span>
        <span className="kys-person-status">{yesNo(person.pepMatch)}</span>
        <span className="kys-person-toggle" aria-hidden="true"><span className="kys-person-open-label">Rozwiń</span><span className="kys-person-close-label">Zwiń</span></span>
      </summary>
      <dl className="kys-person-details">
        <dt>Funkcja / powiązanie</dt><dd>{person.positions.join(", ") || "brak danych"}</dd>
        <dt>Obywatelstwo</dt><dd>{person.citizenship.join(", ") || "brak danych"}</dd>
        <dt>Rejestr</dt><dd>{person.foundIn.join(", ") || "brak danych"}</dd>
        {showBirthDate && <><dt>Data urodzenia</dt><dd>{value(person.birthDate)}</dd></>}
      </dl>
    </details>;
  })}</div></div>;
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
        <dt>PKD</dt><dd>{value(data?.mainPkd)}</dd>
      </dl>
    </SectionFrame>
  );
}

export function FinancialDataMount({ section, onDownloadExcel, selectedScope, onScopeChange, selectedPeriod }: { section: DisplaySection<FinancialData>; onDownloadExcel?: (scope: "standalone" | "consolidated", years: string[]) => Promise<void>;
  selectedScope?: FinancialPeriod["scope"] | null; onScopeChange?: (scope: FinancialPeriod["scope"]) => void; selectedPeriod?: FinancialPeriodSelection | null }) {
  return (
    <SectionFrame title="Dane finansowe" section={section}>
      {section.data ? <FinancialDashboard data={section.data} onDownloadExcel={onDownloadExcel} selectedScope={selectedScope} onScopeChange={onScopeChange} selectedPeriod={selectedPeriod} /> : <p>brak danych</p>}
    </SectionFrame>
  );
}

export function VerclyKysMount({ section, entityType = "COMPANY", onRevealPesel }: {
  section: DisplaySection<VerclyKysData>;
  entityType?: "COMPANY" | "JDG";
  onRevealPesel?: (token: string) => Promise<string>;
}) {
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
              <dt>Telefon</dt><dd>{value(company?.phone)}</dd>
              <dt>Dzielnica / gmina</dt><dd>{value(company?.municipality)}</dd>
              <dt>Powiat</dt><dd>{value(company?.district)}</dd>
              <dt>Województwo</dt><dd>{value(company?.voivodship)}</dd>
              <dt>Kraj</dt><dd>{company?.country === "PL" ? "Polska" : value(company?.country)}</dd>
              <dt>Kraj głównej siedziby</dt><dd>{value(company?.headquarterCountry)}</dd>
              <dt>Status działalności</dt><dd>{polishCode(company?.activityStatus, activityStatusLabels)}</dd>
              <dt>Data powstania</dt><dd>{value(company?.createdAt)}</dd>
              <dt>Data wpisu</dt><dd>{value(company?.registeredAt)}</dd>
              <dt>Data rozpoczęcia działalności</dt><dd>{value(company?.commencedAt)}</dd>
              <dt>Ostatnia zmiana</dt><dd>{value(company?.lastChangedAt)}</dd>
              <dt>PKD</dt><dd>{value(company?.mainPkd)}</dd>
              {entityType === "COMPANY" && <><dt>Kapitał zakładowy</dt><dd>{capitalInThousands(company?.shareCapital)}</dd>
              <dt>Zasady reprezentacji</dt><dd>{value(company?.representation)}</dd>
              <dt>Organ rejestrowy</dt><dd>{value(company?.registerAuthority)}</dd>
              <dt>Forma własności</dt><dd>{value(company?.ownershipForm)}</dd></>}
            </dl>
          </section>
          <div className="kys-column">
          <section className="kys-panel" aria-label="Rejestry i statusy">
            <h3>Rejestry i statusy</h3>
            <dl className="xray-facts">
              <dt>Odpytane rejestry</dt><dd>{data?.queriedRegisters.length ? data.queriedRegisters.map((name) => registerLabels[name] ?? name).join(", ") : "nie ustalono"}</dd>
              <dt>Wpis w Krajowym Rejestrze Zadłużonych</dt><dd>{yesNo(data?.registryChecks?.krzListed)}</dd>
              <dt>Podatnik VAT czynny</dt><dd>{yesNo(data?.registryChecks?.vatActive)}</dd>
              <dt>Podatnik VAT UE</dt><dd>{yesNo(data?.registryChecks?.euVat)}</dd>
              <dt>Podmiot i bezpośrednio powiązani na listach sankcyjnych</dt><dd>{yesNo(data?.screeningSummary?.directlyRelatedSanctions)}</dd>
              <dt>Beneficjenci i powiązane podmioty na listach sankcyjnych</dt><dd>{yesNo(data?.screeningSummary?.beneficiaryRelatedSanctions)}</dd>
              <dt>Podmiot na pozostałych listach</dt><dd>{yesNo(data?.screeningSummary?.otherLists)}</dd>
            </dl>
          </section>
          <section className="kys-panel" aria-label="Listy sankcyjne i ostrzeżenia">
            <h3>Listy sankcyjne i ostrzeżenia</h3>
            {lists.length ? <table className="kys-lists"><thead><tr><th>Lista</th><th>Wynik</th></tr></thead><tbody>
              {lists.map((entry) => <tr key={`${entry.type}:${entry.name}`}><td>{verclyListLabels[entry.name] ?? entry.name.replaceAll("_", " ")}</td><td>{yesNo(entry.matched)}</td></tr>)}
            </tbody></table> : <p>brak danych</p>}
          </section>
          </div>
        </div>
        <section className="kys-panel" aria-label="Osoby pełniące funkcje kierownicze i nadzorcze">
          <h3>Osoby pełniące funkcje kierownicze i nadzorcze</h3>
          <p className="kys-note">{countLabel(data?.relatedPersonsCount)}</p>
          <KysPeopleTable people={data?.relatedPersons} onRevealPesel={onRevealPesel} />
        </section>
        <section className="kys-panel" aria-label="Beneficjenci rzeczywiści">
          <h3>Beneficjenci rzeczywiści</h3>
          <p className="kys-note">{countLabel(data?.beneficialOwnersCount)}</p>
          <KysPeopleTable people={data?.beneficialOwners} onRevealPesel={onRevealPesel} showBirthDate={false} kind="beneficiary" />
        </section>
        <section className="kys-panel kys-pep-panel" aria-label="Osoby na eksponowanych stanowiskach politycznych">
          <h3>Osoby na eksponowanych stanowiskach politycznych</h3>
          <p className="kys-note">{data?.pepMatches ? pepMatchCount(data.pepMatches.length) : "brak danych"}</p>
          {data?.pepMatches?.length ? <div className="kys-table-scroll"><table className="kys-lists kys-pep-table">
            <thead><tr><th>Dopasowano na podstawie</th><th>Osoba na liście</th><th>Data urodzenia</th><th>Stanowisko</th><th>Prawdopodobieństwo dopasowania</th></tr></thead>
            <tbody>{data.pepMatches.map((match, index) => {
              const person = data[match.personGroup]?.[match.personIndex];
              return <tr key={`${match.personGroup}:${match.personIndex}:${index}`}>
                <td><strong>{value(match.searchPhrase ?? match.personName)}</strong>
                  <small>{match.personName}</small>
                  {match.identifierMatchesPesel && <small>PESEL: <PeselReveal token={person?.peselRevealToken} onReveal={onRevealPesel} /></small>}
                  {person?.citizenship.length ? <small>Obywatelstwo: {person.citizenship.join(", ")}</small> : null}
                </td>
                <td><strong>{value(match.matchedName)}</strong>
                  {match.aliases.length ? <small>Inne nazwy: {match.aliases.join(", ")}</small> : null}
                </td>
                <td>{value(match.birthDate)}</td>
                <td>{match.positions.length ? match.positions.join("; ") : "Szczegóły stanowiska niedostępne"}</td>
                <td>{match.probabilityPercent === null ? "nie ustalono" : `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(match.probabilityPercent)}%`}</td>
              </tr>;
            })}</tbody>
          </table></div> : <p>Nie stwierdzono dopasowań PEP w danych osób zwróconych przez dostawcę.</p>}
        </section>
        {entityType === "COMPANY" && <section className="kys-panel" aria-label="Struktura właścicielska i powiązane podmioty">
          <h3>Struktura właścicielska i powiązane podmioty</h3>
          {data?.relatedEntities?.length ? <div className="kys-table-scroll"><table className="kys-lists"><thead><tr><th>Podmiot</th><th>Powiązanie</th><th>Identyfikatory</th><th>Okres</th><th>Sankcje</th></tr></thead><tbody>
            {data.relatedEntities.map((entry, index) => <tr key={`${entry.name}:${index}`}>
              <td><strong>{entry.name}</strong>{entry.stakeDescription && <small>{entry.stakeDescription}</small>}</td>
              <td>{entry.role === "SHAREHOLDER" ? "Udziałowiec" : value(entry.role)}</td>
              <td>{[entry.krs && `KRS ${entry.krs}`, entry.nip && `NIP ${entry.nip}`, entry.regon && `REGON ${entry.regon}`].filter(Boolean).join(" · ") || "brak danych"}</td>
              <td>{[entry.relationshipStart, entry.relationshipEnd].filter(Boolean).join(" – ") || "brak danych"}</td>
              <td>{yesNo(entry.sanctionsMatch)}</td>
            </tr>)}
          </tbody></table></div> : <p>brak danych</p>}
        </section>}
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
