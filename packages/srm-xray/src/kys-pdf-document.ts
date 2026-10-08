import type { VerclyKysData, VerclyPerson } from "./contracts";
import { activityStatusLabels, capitalInThousands, legalFormLabels, polishCode, registerLabels, value, verclyListLabels, warningLabel } from "./kys-content";

export type KysPdfSelection = { nip: string; entityType: "COMPANY" | "JDG"; retrievedAt: string; exportRef: string };
export type KysPdfRecord = { title: string; fields: readonly (readonly [string, string])[] };
export type KysPdfSection = { id: string; title: string; note?: string; records: readonly KysPdfRecord[] };
export type KysPdfDocument = { title: string; companyName: string; nip: string; entityType: "COMPANY" | "JDG";
  retrievedAt: string; generatedAt: string; expiresAt: string; sections: readonly KysPdfSection[] };

/** Exact approved full-view field coverage, with no reveal token, RAW or private metadata. */
export const kysPdfCoverage = [
  { ui: "Dane rejestrowe", pdf: "identity", scope: "COMPANY/JDG: wszystkie pola widoczne dla typu podmiotu" },
  { ui: "Rejestry i statusy", pdf: "registry", scope: "Odpytane rejestry, KRZ, VAT, VIES i trzy wyniki zbiorcze" },
  { ui: "Listy sankcyjne i ostrzeżenia", pdf: "lists", scope: "Wszystkie zwrócone listy i wyniki" },
  { ui: "Osoby pełniące funkcje kierownicze i nadzorcze", pdf: "people", scope: "Wszystkie osoby, funkcje, obywatelstwo, rejestry, data urodzenia, wyniki; PESEL zamaskowany" },
  { ui: "Beneficjenci rzeczywiści", pdf: "beneficiaries", scope: "Wszyscy beneficjenci i rozwijane pola; bez daty urodzenia, jak w UI; PESEL zamaskowany" },
  { ui: "Osoby na eksponowanych stanowiskach politycznych", pdf: "pep", scope: "Wszystkie dopasowania, frazy, osoby, aliasy, daty, stanowiska i miara dopasowania; PESEL zamaskowany" },
  { ui: "Struktura właścicielska i powiązane podmioty", pdf: "relations", scope: "COMPANY: wszystkie relacje, identyfikatory, okresy, opis udziału i wyniki" },
  { ui: "Stan, uwagi i stopka pełnego KYS", pdf: "metadata", scope: "Kompletność, źródłowy poziom ryzyka jeśli istnieje, daty, ID raportu/zapytania i bezpieczne uwagi" },
] as const;

const outcome = (v: boolean | null | undefined) => v === true ? "Zwrócono dopasowanie - wymaga weryfikacji" : v === false ? "Nie zwrócono dopasowania w podanym wyniku" : "Nie ustalono";
const status = (v: boolean | null | undefined) => v === true ? "Tak - w zwróconym wyniku" : v === false ? "Nie - w zwróconym wyniku" : "Nie ustalono";
const joined = (a: readonly string[] | undefined) => a?.length ? a.join(", ") : "brak danych";
const count = (n: number | null | undefined) => n == null ? "brak danych" : `${n} wpisów w raporcie`;
const masked = (person?: VerclyPerson) => /^\d{11}$/.test(person?.pesel ?? "") || person?.peselRevealToken ? "*********** (numer ukryty)" : "brak danych";
function personRecord(person: VerclyPerson, index: number, beneficiary = false): KysPdfRecord {
  return { title: `${index + 1}. ${person.fullName}`, fields: [
    ["Funkcja / powiązanie", joined(person.positions)], ["Rejestr", joined(person.foundIn)],
    ["Obywatelstwo", joined(person.citizenship)], ["PESEL", masked(person)],
    ["Sankcje", outcome(person.sanctionsMatch)], ["PEP", outcome(person.pepMatch)],
    ...(!beneficiary ? [["Data urodzenia", value(person.birthDate)] as const] : []),
  ] };
}

/** Presentation projection only; no fetch, calculation, HTML parsing or persistence. */
export function kysPdfDocument(data: VerclyKysData, context: Omit<KysPdfDocument, "title" | "companyName" | "sections"> & { partial: boolean; warnings: readonly string[] }): KysPdfDocument {
  const c = data.company;
  const identity: KysPdfRecord = { title: "Dane podmiotu", fields: [
    ["Nazwa", value(c?.name)], ...(context.entityType === "COMPANY" ? [["KRS", value(c?.krs)] as const] : []),
    ["NIP", value(c?.nip)], ["REGON", value(c?.regon)], ["Forma prawna", polishCode(c?.legalForm, legalFormLabels)],
    ["Adres", value(c?.address)], ["Telefon", value(c?.phone)], ["Dzielnica / gmina", value(c?.municipality)],
    ["Powiat", value(c?.district)], ["Województwo", value(c?.voivodship)], ["Kraj", c?.country === "PL" ? "Polska" : value(c?.country)],
    ["Kraj głównej siedziby", value(c?.headquarterCountry)], ["Status działalności", polishCode(c?.activityStatus, activityStatusLabels)],
    ["Data powstania", value(c?.createdAt)], ["Data wpisu", value(c?.registeredAt)], ["Data rozpoczęcia działalności", value(c?.commencedAt)],
    ["Ostatnia zmiana", value(c?.lastChangedAt)], ["PKD", value(c?.mainPkd)],
    ...(context.entityType === "COMPANY" ? [["Kapitał zakładowy", capitalInThousands(c?.shareCapital)], ["Zasady reprezentacji", value(c?.representation)],
      ["Organ rejestrowy", value(c?.registerAuthority)], ["Forma własności", value(c?.ownershipForm)]] as const : []),
  ] };
  const sections: KysPdfSection[] = [
    { id: "metadata", title: "1. Zakres i stan raportu", records: [{ title: context.partial ? "Raport częściowy" : "Raport dostępny", fields: [
      ["Kompletność", context.partial ? "Raport zawiera ograniczenia dostępności danych" : "Zapisany raport zakończony; nie oznacza wykonania każdej możliwej kontroli"],
      ["Stan danych według raportu", value(data.stateAsOf)], ["Data pozyskania KYS", context.retrievedAt],
      ["Data wygenerowania PDF", context.generatedAt], ["Koniec dozwolonego eksportu w SRM", context.expiresAt],
      ["ID raportu", value(data.reportId)], ["Identyfikator zapytania", value(data.correlationId)],
      ...(data.riskLevel ? [["Oznaczenie poziomu ryzyka w zapisanym raporcie", data.riskLevel], ["Znaczenie oznaczenia", "Wartość źródłowa; SRM nie wyznacza nowego scoringu ani nie potwierdza bezpieczeństwa dostawcy"]] as const : []),
      ...context.warnings.map((w, i) => [`Uwaga ${i + 1}`, warningLabel(w)] as const),
    ] }] },
    { id: "identity", title: "2. Dane identyfikacyjne i rejestrowe", records: [identity] },
    { id: "registry", title: "3. Rejestry i statusy", note: "Wynik i dowód wykonania kontroli są odrębne. Brak informacji nie oznacza wyniku negatywnego.", records: [{ title: "Zwrócony zakres", fields: [
      ["Odpytane rejestry", data.queriedRegisters?.length ? data.queriedRegisters.map(n => registerLabels[n] ?? n).join(", ") : "Nie ustalono"],
      ["Wpis w Krajowym Rejestrze Zadłużonych", status(data.registryChecks?.krzListed)], ["Podatnik VAT czynny", status(data.registryChecks?.vatActive)],
      ["Podatnik VAT UE", status(data.registryChecks?.euVat)],
      ["Podmiot i bezpośrednio powiązani - sankcje", outcome(data.screeningSummary?.directlyRelatedSanctions)],
      ["Beneficjenci i powiązane podmioty - sankcje", outcome(data.screeningSummary?.beneficiaryRelatedSanctions)],
      ["Podmiot na pozostałych listach", outcome(data.screeningSummary?.otherLists)],
    ] }] },
    { id: "lists", title: "4. Listy sankcyjne i ostrzeżenia", note: "Wyłącznie zakres zwrócony w raporcie. Dopasowanie wymaga sprawdzenia tożsamości i szczegółów.", records: data.screenedLists?.map((e, i) => ({ title: `${i + 1}. ${verclyListLabels[e.name] ?? e.name.replaceAll("_", " ")}`, fields: [["Wynik", outcome(e.matched)]] })) ?? [] },
    { id: "people", title: "5. Osoby pełniące funkcje kierownicze i nadzorcze", note: `Liczba według raportu: ${count(data.relatedPersonsCount)}.`, records: data.relatedPersons?.map((p, i) => personRecord(p, i)) ?? [] },
    { id: "beneficiaries", title: "6. Beneficjenci rzeczywiści", note: `Liczba według raportu: ${count(data.beneficialOwnersCount)}.`, records: data.beneficialOwners?.map((p, i) => personRecord(p, i, true)) ?? [] },
    { id: "pep", title: "7. Dopasowania PEP", note: data.pepMatches ? `${data.pepMatches.length} dopasowań w raporcie. Miara dopasowania nie jest prawdopodobieństwem naruszenia ani potwierdzeniem tożsamości.` : "Nie ustalono dostępności wyników PEP.", records: data.pepMatches?.map((m, i) => ({ title: `${i + 1}. Dopasowanie wymagające weryfikacji`, fields: [
      ["Dopasowano na podstawie", m.identifierMatchesPesel ? value(m.searchPhrase ?? m.personName).replace(/\b\d{11}\b/g, "***********") : value(m.searchPhrase ?? m.personName)], ["Osoba użyta do sprawdzenia", value(m.personName)],
      ...(m.identifierMatchesPesel ? [["PESEL", masked(data[m.personGroup]?.[m.personIndex])]] as const : []),
      ["Obywatelstwo", joined(data[m.personGroup]?.[m.personIndex]?.citizenship)], ["Osoba na liście", value(m.matchedName)],
      ["Inne nazwy", joined(m.aliases)], ["Data urodzenia osoby na liście", value(m.birthDate)], ["Stanowisko", joined(m.positions)],
      ["Miara dopasowania z raportu", m.probabilityPercent == null ? "Nie ustalono" : `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(m.probabilityPercent)}%`],
    ] })) ?? [] },
  ];
  if (context.entityType === "COMPANY") sections.push({ id: "relations", title: "8. Struktura właścicielska i powiązane podmioty", records: data.relatedEntities?.map((e, i) => ({ title: `${i + 1}. ${e.name}`, fields: [
    ["Opis udziału", value(e.stakeDescription)], ["Powiązanie", e.role === "SHAREHOLDER" ? "Udziałowiec" : value(e.role)],
    ["Identyfikatory", [e.krs && `KRS ${e.krs}`, e.nip && `NIP ${e.nip}`, e.regon && `REGON ${e.regon}`].filter(Boolean).join(" · ") || "brak danych"],
    ["Okres powiązania", [e.relationshipStart, e.relationshipEnd].filter(Boolean).join(" - ") || "brak danych"], ["Sankcje", outcome(e.sanctionsMatch)],
  ] })) ?? [] });
  sections.push({ id: "limitations", title: `${context.entityType === "COMPANY" ? 9 : 8}. Ograniczenia i metodologia`, records: [{ title: "Jak korzystać z raportu", fields: [
    ["Zakres czasowy", "Raport odzwierciedla dane dostępne w chwili pozyskania KYS. Wygenerowanie PDF nie stanowi ponownej kontroli."],
    ["Braki i zakres", "Brak danych nie oznacza braku zdarzenia. Pusta lista nie potwierdza wykonania pełnej kontroli; brak dopasowania nie gwarantuje bezpieczeństwa."],
    ["Dopasowania", "Wyniki list i PEP wymagają weryfikacji tożsamości i szczegółów. Wyniki osób i podmiotów powiązanych nie muszą dotyczyć bezpośrednio dostawcy."],
    ["Dane osobowe", "PESEL pozostaje zamaskowany. PDF nie uruchamia ujawniania numerów ani ponownego pobrania KYS."],
    ["Ocena kupca", "Raport nie jest certyfikatem zgodności ani oceną bezpieczeństwa; nie zastępuje indywidualnej analizy kupca. Dalsze przechowywanie i obieg pliku wymagają przestrzegania zasad organizacji."],
  ] }] });
  const identifiers = [...(data.relatedPersons ?? []), ...(data.beneficialOwners ?? [])].map(p => p.pesel).filter((p): p is string => !!p && /^\d{11}$/.test(p));
  const protect = (input: string) => identifiers.reduce((output, id) => output.replaceAll(id, "***********"), input);
  return { title: "Raport KYS — Weryfikacja dostawcy", companyName: protect(value(c?.name)), nip: context.nip, entityType: context.entityType,
    retrievedAt: context.retrievedAt, generatedAt: context.generatedAt, expiresAt: context.expiresAt,
    sections: sections.map(section => ({ ...section, records: section.records.map(record => ({ title: protect(record.title), fields: record.fields.map(([label, content]) => [label, protect(content)] as const) })) })) };

}
