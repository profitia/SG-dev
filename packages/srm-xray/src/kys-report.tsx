"use client";
import {useXRayText,useXRayLocale} from "./i18n";
import React, { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { SectionEnvelope, VerclyKysData, VerclyPerson } from "./contracts";
import { CanonButton, CanonElement } from "./ui-canon";
import { value, warningLabel, polishCode, yesNo, capitalInThousands, legalFormLabels, registerLabels, kysRegistryRows, kysListRows } from "./kys-content";

/** Icons from MagicPath SRM-I13/I16/I17/I18/I19; no external assets or personal data. */
export function KysIcon({ kind }: { kind: "download" | "refresh" | "chevron" | "eye-open" | "eye-closed" }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {kind === "download" ? <path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5" />
      : kind === "refresh" ? <path d="M20 7v5h-5M20 12a8 8 0 1 0-2 5" />
      : kind === "chevron" ? <path d="m6 9 6 6 6-6" />
      : kind === "eye-open" ? <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>
      : <path d="M3 9c2 4 5 6 9 6s7-2 9-6M5 12l-2 3m6-1-1 4m7-4 1 4m3-6 2 3" />}
  </svg>;
}
const tabs = [
  { id: "summary", label: "Podsumowanie", targets: ["identity"] },
  { id: "registers", label: "Rejestry, statusy i sankcje", targets: ["registry", "lists"] },
  { id: "management", label: "Kierownictwo i nadzór", targets: ["people", "pep"] },
  { id: "beneficiaries", label: "Beneficjenci rzeczywiści", targets: ["beneficiaries"] },
  { id: "ownership", label: "Struktura właścicielska i podmioty", targets: ["relations"] },
] as const;
type KysTab = typeof tabs[number]["id"];
function pepMatchCount(count: number,locale="pl"): string {
  if(locale==="en")return `${count} matches in the report`;
  const form = new Intl.PluralRules("pl-PL").select(count);
  return `${count} ${form === "one" ? "dopasowanie" : form === "few" ? "dopasowania" : "dopasowań"} w raporcie`;
}
function PeselReveal({ token, onReveal }: { token: string | null | undefined; onReveal?: (token: string) => Promise<string> }) {
  const t=useXRayText();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const id = useId();
  const alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const currentToken = useRef(token);
  currentToken.current = token;
  useEffect(() => { setRevealed(null); setError(false); setBusy(false); }, [token]);
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
  return <CanonElement as="span" canonId="SRM-C58" usage="kys-pesel:mask" className="srm-pesel-control">
    <span id={id}>
    {revealed ? <span>{revealed}</span> : token ? <span className="kys-pesel-mask" aria-label={t("Numer ukryty")}>{t("•••••••••••")}</span> : t("brak danych")}
    </span>
    {token && onReveal && <CanonButton canonId="SRM-C59" usage="kys-pesel:visibility" aria-controls={id} aria-pressed={!!revealed} aria-label={busy ? "Pobieranie numeru PESEL" : revealed ? "Ukryj PESEL" : "Pokaż PESEL"} title={revealed ? "Ukryj PESEL" : "Pokaż PESEL"} type="button" className="kys-pesel-button" disabled={busy} onClick={async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (revealed) { setRevealed(null); return; }
      setBusy(true);
      setError(false);
      try {
        const pesel = await onReveal(token);
        if (alive.current && currentToken.current === token && !document.hidden && document.hasFocus() && /^\d{11}$/.test(pesel)) setRevealed(pesel);
        else if (alive.current && currentToken.current === token) setError(true);
      } catch { if (alive.current && currentToken.current === token) setError(true); }
      finally { if (alive.current && currentToken.current === token) setBusy(false); }
    }}><KysIcon kind={revealed ? "eye-closed" : "eye-open"} /></CanonButton>}
    {error && <span className="kys-pesel-error" role="alert">{t("Nie udało się ujawnić numeru.")}</span>}
  </CanonElement>;
}

function KysPeopleTable({ people, count, onRevealPesel, beneficiaries = false }: {
  people: readonly VerclyPerson[] | undefined; count?: number | null;
  onRevealPesel?: (token: string) => Promise<string>; beneficiaries?: boolean;
}) {
  const t=useXRayText();
  const id = useId();
  const [expanded, setExpanded] = useState<number[]>([]);
  if (!people?.length) return <p>{t("brak danych")}</p>;
  return <div className="srm-kys-table-scroll" role="region" tabIndex={0} aria-label={beneficiaries ? "Tabela beneficjentów rzeczywistych" : "Tabela kierownictwa i nadzoru"}>
    <CanonElement as="table" canonId="SRM-C57" usage="kys-people:table" className={`srm-kys-table srm-kys-people ${beneficiaries ? "has-relations" : "is-management"}`}>
      <caption>{count == null ? t("Liczba wpisów: nie ustalono") : `${count} ${t("wpisów w raporcie")}`}</caption>
      <thead><tr><th scope="col">{t("Imię i nazwisko")}</th><th scope="col">{t("Rola / funkcja")}</th><th scope="col">{t("PESEL")}</th><th scope="col">{t("Sankcje")}</th><th scope="col">{t("PEP")}</th>{beneficiaries && <th scope="col"><span className="srm-sr-only">{t("Szczegóły")}</span></th>}</tr></thead>
      <tbody>{people.map((person, index) => {
        const open = expanded.includes(index), rowId = `${id}-${index}`;
        return <React.Fragment key={`${person.fullName}:${index}`}><tr className="kys-person-entry">
          <th scope="row">{person.fullName}</th><td>{person.positions.join(", ") || t("brak danych")}</td>
          <td><PeselReveal token={person.peselRevealToken} onReveal={onRevealPesel} /></td>
          <td>{t(yesNo(person.sanctionsMatch))}</td><td>{t(yesNo(person.pepMatch))}</td>
          {beneficiaries && <td><CanonButton canonId="SRM-C55" usage="kys-people:relation" className="srm-text-link srm-kys-expand" type="button" aria-expanded={open} aria-controls={rowId} onClick={() => setExpanded(previous => open ? previous.filter(i => i !== index) : [...previous, index])}>{open ? t("Zwiń") : t("Rozwiń")}<KysIcon kind="chevron" /></CanonButton></td>}
        </tr>{beneficiaries && <tr id={rowId} hidden={!open} className="srm-kys-person-detail"><td colSpan={6}><dl><div><dt>{t("Powiązanie / rejestr")}</dt><dd>{person.foundIn.join(", ") || t("brak danych")}</dd></div></dl></td></tr>}</React.Fragment>;
      })}</tbody>
    </CanonElement>
  </div>;
}

export function VerclyKysReport({ section, entityType = "COMPANY", onRevealPesel, overview }: {
  section: Omit<SectionEnvelope<VerclyKysData>, "source">; entityType?: "COMPANY" | "JDG";
  onRevealPesel?: (token: string) => Promise<string>; overview?: ReactNode;
}) {
  const t=useXRayText();
  const locale=useXRayLocale();
  const display=(text:string|null|undefined)=>text||t("brak danych");
  const id = useId(), tablist = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<KysTab>("summary");
  const tabAnchor = useRef<number | null>(null);
  const [panelFloor, setPanelFloor] = useState(0);
  useLayoutEffect(() => {
    if (tabAnchor.current === null || !tablist.current) return;
    const delta = tablist.current.getBoundingClientRect().top - tabAnchor.current;
    tabAnchor.current = null;
    // Preserve the navigation position, including browser scroll anchoring.
    if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: "instant" });
  }, [tab]);
  const availableTabs = tabs.filter(item => entityType === "COMPANY" || item.id !== "ownership");
  const data = section.data, company = data?.company;
  const target = (group: string) => ({ id: `${id}-${group}`, "data-kys-detail": group, tabIndex: -1 });
  const select = (selected: KysTab) => {
    if (selected === tab) return;
    const rect = tablist.current?.getBoundingClientRect();
    if (rect) {
      tabAnchor.current = rect.top;
      // Reserve only the visible space below the tabs, not the previous panel's height.
      // This prevents the document bottom from clamping scroll on shorter tabs.
      setPanelFloor(Math.max(0, window.innerHeight - rect.bottom));
    }
    setTab(selected);
  };
  function keyboard(event: React.KeyboardEvent, index: number) {
    let next: number | undefined;
    if (event.key === "ArrowRight") next = (index + 1) % availableTabs.length;
    if (event.key === "ArrowLeft") next = (index + availableTabs.length - 1) % availableTabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = availableTabs.length - 1;
    if (next !== undefined) { event.preventDefault(); select(availableTabs[next].id); tablist.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus({ preventScroll: true }); }
  }
  if (section.status === "PENDING") return <div role="status"><p>{t("Raport jest przygotowywany. Poczekaj na wynik…")}</p><div className="kys-progress" role="progressbar" aria-label={t("Postęp pobierania raportu KYS")} aria-valuetext={t("Pobieranie trwa")}><span /></div></div>;
  if (!data || !["SUCCESS", "PARTIAL"].includes(section.status)) return <p role="status">{section.status === "ERROR" ? t("Raport KYS jest niedostępny.") : t("brak danych")}</p>;
  const registry = kysRegistryRows(data), lists = kysListRows(data);
  const sanctions = (data.screenedLists ?? []).filter(row => row.type.toUpperCase() === "SANCTIONS");
  const companyFields: [string, string][] = [
    ["Nazwa", display(company?.name)], ...(entityType === "COMPANY" ? [["KRS", display(company?.krs)] as [string,string]] : []),
    ["NIP", display(company?.nip)], ["REGON", display(company?.regon)], ["Forma prawna", t(polishCode(company?.legalForm, legalFormLabels))],
    ["Adres", display(company?.address)], ["Telefon", display(company?.phone)], ["Dzielnica / gmina", display(company?.municipality)],
    ["Powiat", display(company?.district)], ["Województwo", display(company?.voivodship)], ["Kraj", company?.country === "PL" ? t("Polska") : display(company?.country)],
    ["Kraj głównej siedziby", display(company?.headquarterCountry)], ["Status działalności", t(registry[3][1])],
    ["Data powstania", display(company?.createdAt)], ["Data wpisu", display(company?.registeredAt)], ["Data rozpoczęcia działalności", display(company?.commencedAt)],
    ["Ostatnia zmiana", display(company?.lastChangedAt)], ["PKD", display(company?.mainPkd)],
    ...(entityType === "COMPANY" ? [["Kapitał zakładowy", t(capitalInThousands(company?.shareCapital).replace("tys. PLN",locale==="en"?"thousand PLN":"tys. PLN"))], ["Zasady reprezentacji", display(company?.representation)], ["Organ rejestrowy", display(company?.registerAuthority)], ["Forma własności", display(company?.ownershipForm)]] as [string,string][] : []),
  ];
  return <div className="srm-kys-report">
    {section.status === "PARTIAL" && <p role="status">{t("Dane częściowe")}</p>}
    {section.warnings.map((warning, index) => <p className="xray-warning" key={index}>{t(warningLabel(warning))}</p>)}
    <div className="srm-category-tabs srm-kys-tabs" role="tablist" aria-label={t("Obszary raportu KYS")} ref={tablist}>{availableTabs.map((item, index) =>
      <CanonButton canonId="SRM-C08" usage="kys-report:tab" type="button" key={item.id} role="tab" id={`${id}-tab-${item.id}`} aria-selected={tab === item.id} aria-controls={`${id}-panel-${item.id}`} data-kys-tab-for={item.targets.join(" ")} tabIndex={tab === item.id ? 0 : -1} onClick={() => select(item.id)} onKeyDown={event => keyboard(event,index)}>{t(item.label)}</CanonButton>
    )}</div>
    {availableTabs.map(item => <div key={item.id} id={`${id}-panel-${item.id}`} role="tabpanel" aria-labelledby={`${id}-tab-${item.id}`} hidden={tab !== item.id} tabIndex={0} className="srm-kys-panel" style={{ minHeight: panelFloor }}>
      {/* Changing tabs unmounts any revealed identifier, including in-flight requests. */}
      <div key={tab}>
      {item.id === "summary" && <>
        <div className="srm-kys-company"><h3>{display(company?.name)}</h3><div><span>{t("Poziom ryzyka: ")}<strong>{display(data.riskLevel)}</strong></span><span>{t("Sankcje: ")}<strong>{t(yesNo(sanctions.some(row => row.matched === true) ? true : sanctions.length && sanctions.every(row => row.matched === false) ? false : null))}</strong></span></div></div>
        {overview}
        <section {...target("identity")} aria-label={t("Dane rejestrowe KYS")}><div className="srm-kys-section-title"><h3>{t("Dane rejestrowe")}</h3></div>
          <CanonElement as="dl" canonId="SRM-C57" usage="kys-report:identity" className="srm-kys-registration">{companyFields.map(([label, text]) => <div key={label} className={["Nazwa", "Zasady reprezentacji", "Organ rejestrowy", "PKD"].includes(label) ? "srm-kys-field-wide" : undefined}><dt>{t(label)}</dt><dd>{text}</dd></div>)}</CanonElement>
        </section>
      </>}
      {item.id === "registers" && <>
        <section {...target("registry")}><div className="srm-kys-section-title"><h3>{t("Rejestry i statusy")}</h3></div><div className="srm-kys-table-scroll">
          <CanonElement as="table" canonId="SRM-C57" usage="kys-report:registry" className="srm-kys-table srm-kys-register-table"><thead><tr><th scope="col">{t("Rejestr / zakres")}</th><th scope="col">{t("Zwrócony wynik")}</th></tr></thead><tbody>
            {registry.map(([label, result]) => <tr key={label}><th scope="row">{t(label)}</th><td>{t(result)}</td></tr>)}
            <tr className="srm-kys-queried"><th scope="row">{t("Odpytane rejestry")}</th><td>{data.queriedRegisters.length ? data.queriedRegisters.map(name => registerLabels[name] ?? name).join(", ") : t("nie ustalono")}</td></tr>
          </tbody></CanonElement>
        </div></section>
        <section {...target("lists")}><div className="srm-kys-section-title"><h3>{t("Listy sankcyjne i ostrzeżenia")}</h3></div>{lists.length ? <div className="srm-kys-table-scroll"><CanonElement as="table" canonId="SRM-C57" usage="kys-report:lists" className="srm-kys-table srm-kys-register-table"><thead><tr><th scope="col">{t("Lista")}</th><th scope="col">{t("Wynik")}</th></tr></thead><tbody>{lists.map((row,index) => <tr key={`${row.label}:${index}`}><th scope="row">{row.label}</th><td>{t(row.result)}</td></tr>)}</tbody></CanonElement></div> : <p>{t("brak danych")}</p>}</section>
      </>}
      {item.id === "management" && <>
        <section {...target("people")}><div className="srm-kys-section-title"><h3>{t("Osoby pełniące funkcje kierownicze i nadzorcze")}</h3></div><KysPeopleTable people={data.relatedPersons} count={data.relatedPersonsCount} onRevealPesel={onRevealPesel} /></section>
        <section {...target("pep")} className="srm-kys-pep-section"><div className="srm-kys-section-title"><h3>{t("Osoby na eksponowanych stanowiskach politycznych")}</h3></div>
          <p className="kys-note">{t("Dopasowanie wymaga sprawdzenia tożsamości. Wartość dopasowania nie jest prawdopodobieństwem naruszenia.")}</p>
          <p className="kys-note">{data?.pepMatches ? pepMatchCount(data.pepMatches.length,locale) : t("brak danych")}</p>
          {data?.pepMatches?.length ? <div className="srm-kys-table-scroll"><CanonElement as="table" canonId="SRM-C57" usage="kys-report:pep-table" className="srm-kys-table kys-pep-table">
            <thead><tr><th>{t("Dopasowano na podstawie")}</th><th>{t("Osoba na liście")}</th><th>{t("Data urodzenia")}</th><th>{t("Stanowisko")}</th><th>{t("Prawdopodobieństwo dopasowania")}</th></tr></thead>
            <tbody>{data.pepMatches.map((match, index) => {
              const person = data[match.personGroup]?.[match.personIndex];
              return <tr key={`${match.personGroup}:${match.personIndex}:${index}`}>
                <td><strong>{display(match.searchPhrase ?? match.personName)}</strong>
                  <small>{match.personName}</small>
                  {match.identifierMatchesPesel && <small>{t("PESEL: ")}<PeselReveal token={person?.peselRevealToken} onReveal={onRevealPesel} /></small>}
                  {person?.citizenship.length ? <small>{t("Obywatelstwo: ")}{person.citizenship.join(", ")}</small> : null}
                </td>
                <td><strong>{display(match.matchedName)}</strong>
                  {match.aliases.length ? <small>{t("Inne nazwy: ")}{match.aliases.join(", ")}</small> : null}
                </td>
                <td>{display(match.birthDate)}</td>
                <td>{match.positions.length ? match.positions.join("; ") : t("Szczegóły stanowiska niedostępne")}</td>
                <td>{match.probabilityPercent === null ? t("nie ustalono") : `${new Intl.NumberFormat(locale==="pl"?"pl-PL":"en-GB", { maximumFractionDigits: 0 }).format(match.probabilityPercent)}%`}</td>
              </tr>;
            })}</tbody>
          </CanonElement></div> : <p>{data?.pepMatches ? t("Nie zwrócono dopasowań PEP w danych osób objętych raportem.") : t("Nie ustalono dostępności wyników PEP.")}</p>}
        
        </section>
      </>}
      {item.id === "beneficiaries" && <section {...target("beneficiaries")}><div className="srm-kys-section-title"><h3>{t("Beneficjenci rzeczywiści")}</h3></div><KysPeopleTable people={data.beneficialOwners} count={data.beneficialOwnersCount} beneficiaries onRevealPesel={onRevealPesel} /></section>}
      {item.id === "ownership" && <section {...target("relations")}><div className="srm-kys-section-title"><h3>{t("Struktura właścicielska i powiązane podmioty")}</h3></div>
        {data.relatedEntities?.length ? <div className="srm-kys-table-scroll" tabIndex={0} role="region" aria-label={t("Tabela powiązań podmiotowych")}><CanonElement as="table" canonId="SRM-C57" usage="kys-report:relations" className="srm-kys-table srm-kys-entities"><thead><tr><th scope="col">{t("Podmiot")}</th><th scope="col">{t("Powiązanie")}</th><th scope="col">{t("Identyfikatory")}</th><th scope="col">{t("Okres")}</th><th scope="col">{t("Sankcje")}</th></tr></thead><tbody>
          {data.relatedEntities.map((entry,index) => <tr key={`${entry.name}:${index}`}>
            <th scope="row">{entry.name}{entry.stakeDescription && <small>{entry.stakeDescription}</small>}</th><td>{entry.role === "SHAREHOLDER" ? t("Udziałowiec") : display(entry.role)}</td>
            <td className="srm-kys-identifiers">{[entry.krs && `KRS ${entry.krs}`, entry.nip && `NIP ${entry.nip}`, entry.regon && `REGON ${entry.regon}`].filter(Boolean).join(" · ") || t("brak danych")}</td>
            <td className="srm-kys-dates">{[entry.relationshipStart, entry.relationshipEnd].filter(Boolean).join(" – ") || t("brak danych")}</td><td>{t(yesNo(entry.sanctionsMatch))}</td>
          </tr>)}
        </tbody></CanonElement></div> : <p>{t("brak danych")}</p>}
      </section>}
      </div>
    </div>)}
  </div>;
}
