import type { SectionEnvelope, SupplierReportData, VerclyKysData } from "./contracts";

export type KysDetailTarget = "identity" | "registry" | "lists" | "people" | "beneficiaries" | "pep" | "relations";
export type KysOverviewInput = {
  nip: string; entityType: "COMPANY" | "JDG";
  section: Omit<SectionEnvelope<VerclyKysData>, "source">;
  metadata: SupplierReportData | null; loading?: boolean;
};
export type KysOverviewRow = { label: string; execution?: "PERFORMED" | "UNKNOWN"; result: string; target: KysDetailTarget };
export type KysOverviewGroup = { id: string; title: string; rows: readonly KysOverviewRow[] };
export type KysOverviewModel = {
  available: boolean; visible: boolean; message: string; expiresAt: number | null;
  groups: readonly KysOverviewGroup[]; limitations: readonly string[];
};
const date = (value: string | null | undefined) => value ? Date.parse(value) : NaN;
const count = (value: number | null | undefined) => Number.isSafeInteger(value) && value! >= 0 ? value! : null;
/** Only the approved projection is inspected. No fetch, provider mapping, risk thresholds or personal output. */
export function kysOverview(input: KysOverviewInput, now = Date.now()): KysOverviewModel {
  const { section, metadata, nip, entityType } = input;
  const absent = (message: string, visible = false): KysOverviewModel => ({ available: false, visible, message, expiresAt: null, groups: [], limitations: [] });
  if (section.status === "NOT_REQUESTED") return absent("Raport KYS nie został jeszcze pobrany.");
  if (input.loading || section.status === "PENDING") return absent("Przygotowywanie raportu KYS…");
  if (!section.data || !["SUCCESS", "PARTIAL"].includes(section.status)) return absent("Raport KYS nie jest dostępny do przeglądu.");
  if (!metadata || metadata.nip !== nip || metadata.entityType !== entityType || section.data.company?.nip !== nip)
    return absent("Nie można potwierdzić dostępności tego raportu. Wyniki nie są wyświetlane.", true);
  const k = metadata.kys, f = k.freshness;
  const retention = date(f.retentionUntil), expiry = date(f.cacheExpiresAt);
  if (f.freshness === "EXPIRED" || (Number.isFinite(retention) && retention <= now) || (Number.isFinite(expiry) && expiry <= now))
    return absent("Raport KYS stracił ważność. Wyniki nie są wyświetlane; ponowne pobranie wymaga osobnego działania.", true);
  if (f.freshness !== "FRESH" || !Number.isFinite(retention) || !Number.isFinite(expiry) || !k.reportAvailable ||
      !Number.isFinite(date(section.retrievedAt)) || date(section.retrievedAt) > now || retention <= date(section.retrievedAt) || expiry <= date(section.retrievedAt) || date(section.retrievedAt) !== date(f.retrievedAt))
    return absent("Nie ustalono ważności lub zgodności zapisanej wersji raportu. Wyniki nie są wyświetlane.", true);
  const d = section.data;
  // Exact names observed in the current approved projection; no inferred register aliases.
  const queried = new Set(d.queriedRegisters);
  const registerEvidence: Record<string, readonly string[]> = {
    KRZ: ["KRAJOWY REJESTR ZADŁUŻONYCH", "National Debt Register"],
    VAT: ["WYKAZ PODMIOTÓW ZAREJESTROWANYCH JAKO PODATNICY VAT, NIEZAREJESTROWANYCH ORAZ WYKREŚLONYCH I PRZYWRÓCONYCH DO REJESTRU VAT"],
    "VAT UE (VIES)": ["VAT Information Exchange System"],
  };
  const check = (label: string, value: boolean | null | undefined, yes: string, no: string): KysOverviewRow => ({
    label, execution: typeof value === "boolean" || registerEvidence[label]?.some(name => queried.has(name)) ? "PERFORMED" : "UNKNOWN",
    result: value === true ? yes : value === false ? no : "Nie ustalono wyniku.", target: "registry",
  });
  const lists = d.screenedLists ?? [], matching = lists.filter(l => l.matched === true).length;
  const listEvidence = lists.length > 0 && lists.every(l => typeof l.matched === "boolean" && !!l.name);
  const pep = d.pepMatches?.length ?? 0;
  const representation = !!d.company?.representation?.trim() || (d.relatedPersons?.length ?? 0) > 0;
  const relationMatches = d.relatedEntities?.filter(entry => entry.sanctionsMatch === true).length ?? 0;
  const beneficiaryCount = count(d.beneficialOwnersCount);
  const groups: KysOverviewGroup[] = [
    { id: "registries", title: "Rejestry i status działalności", rows: [
      check("KRZ", d.registryChecks?.krzListed, "Raport wskazuje wpis w KRZ. Sprawdź szczegóły.", "W zwróconym wyniku nie wskazano wpisu w KRZ."),
      check("VAT", d.registryChecks?.vatActive, "Zwrócony status: podatnik VAT czynny.", "Zwrócony status: podatnik VAT nieczynny."),
      check("VAT UE (VIES)", d.registryChecks?.euVat, "Zwrócony status VAT UE: tak.", "Zwrócony status VAT UE: nie."),
      { label: "Status działalności", result: ({ ACTIVE: "Aktywny", INACTIVE: "Nieaktywny", SUSPENDED: "Zawieszony", CLOSED: "Zakończony", LIQUIDATION: "W likwidacji", BANKRUPT: "W upadłości", DISSOLVED: "Rozwiązany", DELETED: "Wykreślony" } as Record<string, string>)[d.company?.activityStatus ?? ""] ?? "Nie ustalono.", target: "identity" },
    ] },
    { id: "lists", title: "Listy sankcyjne i ostrzegawcze", rows: [
      { label: "Wyniki dla badanego podmiotu", execution: listEvidence ? "PERFORMED" : "UNKNOWN", result: listEvidence
        ? matching ? `Zwrócone dopasowania: ${matching} (wyniki ${lists.length} list). Wymagają weryfikacji; nie potwierdzają naruszenia.`
          : `Nie zwrócono dopasowania w wynikach ${lists.length} list. Dotyczy to wyłącznie zwróconego zakresu.`
        : "Nie ustalono zakresu ani wyniku kontroli list.", target: "lists" },
      ...(d.screeningSummary?.directlyRelatedSanctions === true ? [{ label: "Podmiot i bezpośrednio powiązani", result: "Sygnał w grupie podmiotu i bezpośrednio powiązanych. Nie ustalono, kogo dotyczy; wymaga weryfikacji.", target: "registry" as const }] : []),
      ...(d.screeningSummary?.beneficiaryRelatedSanctions === true ? [{ label: "Beneficjenci i powiązane podmioty", result: "Sygnał dotyczący beneficjentów lub powiązanych podmiotów. Nie jest wynikiem bezpośrednio przypisanym dostawcy.", target: "registry" as const }] : []),
      ...(d.screeningSummary?.otherLists === true ? [{ label: "Pozostałe listy", result: "Zwrócono dopasowanie do pozostałych list. Wymaga weryfikacji.", target: "registry" as const }] : []),
    ] },
    { id: "people", title: "Osoby, beneficjenci i PEP", rows: [
      { label: "Reprezentacja", result: representation ? "Informacje o reprezentacji są dostępne w raporcie." : "Nie ustalono dostępności informacji o reprezentacji.", target: d.company?.representation?.trim() ? "identity" : "people" },
      { label: "Beneficjenci", result: (d.beneficialOwners?.length ?? 0) > 0 ? "Informacje o beneficjentach są dostępne w raporcie."
        : beneficiaryCount !== null ? `Zwrócono ${beneficiaryCount} wpisów w raporcie. Nie potwierdza to kompletności danych o beneficjentach.` : "Nie ustalono dostępności informacji o beneficjentach.", target: "beneficiaries" },
      { label: "PEP", execution: pep > 0 ? "PERFORMED" : "UNKNOWN", result: pep > 0
        ? `Zwrócone dopasowania PEP: ${pep}. Wymagają sprawdzenia tożsamości; nie potwierdzają statusu osoby.`
        : "Nie zwrócono szczegółów dopasowań PEP. Nie ustalono zakresu wykonanej kontroli.", target: "pep" },
      ...([ ["beneficialOwners", "beneficiaries", "Beneficjenci — listy"], ["relatedPersons", "people", "Osoby powiązane — listy"] ] as const).flatMap(([field, target, label]) => {
        const matches = d[field]?.filter(person => person.sanctionsMatch === true).length ?? 0;
        return matches > 0 ? [{ label, result: `Wpisy z dopasowaniem do list: ${matches}. Wymagają weryfikacji; dotyczą osób, nie bezpośrednio dostawcy.`, target }] : [];
      }),
    ] },
    ...(entityType === "COMPANY" ? [{ id: "relations", title: "Powiązania podmiotowe", rows: [{ label: "Zapisane relacje", result: d.relatedEntities?.length
      ? `Raport zawiera ${d.relatedEntities.length} zapisanych relacji. Sama liczba powiązań nie jest oceną dostawcy.${relationMatches > 0 ? ` Dopasowania sankcyjne w relacjach: ${relationMatches}. Wymagają weryfikacji; dotyczą powiązanych podmiotów.` : ""}`
      : "Nie ustalono dostępności danych o powiązaniach.", target: "relations" as const }] }] : []),
  ];
  const partial = section.status === "PARTIAL" || !d.isComplete || k.completeness !== "COMPLETE" || section.warnings.length > 0;
  return { available: true, visible: true, expiresAt: Math.min(retention, expiry), groups,
    message: partial ? "Raport jest dostępny, ale zawiera ograniczenia. Kompletność wszystkich obszarów nie jest potwierdzona."
      : "Raport jest dostępny i zakończony. Nie oznacza to wykonania każdej możliwej kontroli.",
    limitations: ["Wykonana oznacza konkretny zwrócony wynik lub odnotowanie danego rejestru jako odpytanego. Samo wykonanie nie potwierdza, że uzyskano rozstrzygający wynik. Brak danych lub pusta lista nie potwierdza wykonania kontroli. Brak dopasowania nie jest gwarancją bezpieczeństwa.",
      ...(partial ? ["Nie wszystkie obszary mają potwierdzone dane. Brak wyniku nie jest negatywnym wynikiem kontroli."] : []),
      ...(d.queriedRegisters.length === 0 ? ["Nie ustalono katalogu odpytanych rejestrów."] : []),
      "Wyniki PEP i dotyczące podmiotów powiązanych nie są automatycznie przypisane badanemu dostawcy. Liczba dopasowań oznacza wpisy w projekcji raportu, nie liczbę potwierdzonych osób."],
  };
}
