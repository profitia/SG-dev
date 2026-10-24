import { IAS_UNAVAILABLE_MESSAGE } from "./report-availability";
import type { VerclyKysData } from "./contracts";
// Shared display semantics for the full KYS view, overview and document export.
export function value(text: string | null | undefined): string {
  return text == null || text === "" ? "brak danych" : text;
}


export function warningLabel(code: string): string {
  if (code === "KRS_HISTORY_INCOMPLETE_MISSING_PREDECESSOR_NIP") return "Starszy wpis w historii spółki nie zawiera NIP-u. Raport obejmuje wyłącznie potwierdzoną część historii.";
  if (code === "FINANCIAL_NO_STRUCTURED_DATA") return "Nie mamy obecnie kwot finansowych do wyświetlenia dla tej firmy.";
  if (code === "FINANCIAL_INTERNATIONAL_STANDARD_UNAVAILABLE") return IAS_UNAVAILABLE_MESSAGE;
  if (code === "FINANCIAL_NO_XML") return "Dla tego sprawozdania nie jest dostępny obsługiwany dokument finansowy XML. Kwoty nie są dostępne.";
  if (code === "FINANCIAL_UNKNOWN_FORMAT") return "Nie udało się potwierdzić dostępności obsługiwanego dokumentu finansowego. Kwoty pozostają niedostępne.";
  if (code === "FINANCIAL_UNSUPPORTED_XML") return "Dokument finansowy jest dostępny, ale jego postać nie pozwala obecnie na odczyt kwot.";
  if (code === "KYS_PROVIDER_NOTICE") return "Raport KYS zawiera uwagę dotyczącą części sprawdzeń.";
  if (code === "KYS_INCOMPLETE_SOURCES") return "Nie wszystkie sprawdzane rejestry zwróciły dane.";
  if (code.startsWith("VERCLY_SEVERITY_")) return "Raport zawiera uwagę dostawcy danych.";
  if (code === "VERCLY_INCOMPLETE_SOURCES") return "Część źródeł nie zwróciła danych.";
  if (code === "IDENTIFIER_MISMATCH") return "Dane identyfikacyjne nie zgadzają się z zapytaniem.";
  return "Źródło nie zwróciło pełnych danych.";
}


export const legalFormLabels: Record<string, string> = {
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
export const activityStatusLabels: Record<string, string> = {
  ACTIVE: "Aktywny", INACTIVE: "Nieaktywny", SUSPENDED: "Zawieszony",
  CLOSED: "Zakończony", LIQUIDATION: "W likwidacji", BANKRUPT: "W upadłości",
  DISSOLVED: "Rozwiązany", DELETED: "Wykreślony",
};
export const registerLabels: Record<string, string> = {
  "VAT Information Exchange System": "System wymiany informacji o VAT (VIES)",
  "National Debt Register": "Krajowy Rejestr Zadłużonych",
  "National Court Register": "Krajowy Rejestr Sądowy",
  "Business Register": "Rejestr przedsiębiorców",
};

export function polishCode(input: string | null | undefined, labels: Record<string, string>): string {
  if (!input) return "nie ustalono";
  const code = input.trim().toUpperCase().replaceAll(/[^A-Z0-9]+/g, "_");
  return labels[code] ?? (/^[A-Z][A-Z0-9_]*$/.test(input) ? "nie ustalono" : input);
}

export function yesNo(input: boolean | null | undefined): string {
  return input === true ? "Tak" : input === false ? "Nie" : "nie ustalono";
}

/** The overview and detailed registry consume the same labels and returned values. */
export function kysRegistryRows(data: VerclyKysData) {
  return [
    ["Krajowy Rejestr Zadłużonych", yesNo(data.registryChecks?.krzListed)],
    ["Podatnik VAT czynny", yesNo(data.registryChecks?.vatActive)],
    ["Podatnik VAT UE", yesNo(data.registryChecks?.euVat)],
    ["Status działalności", polishCode(data.company?.activityStatus, activityStatusLabels)],
    ["Podmiot i bezpośrednio powiązani na listach sankcyjnych", yesNo(data.screeningSummary?.directlyRelatedSanctions)],
    ["Beneficjenci i powiązane podmioty na listach sankcyjnych", yesNo(data.screeningSummary?.beneficiaryRelatedSanctions)],
    ["Podmiot na pozostałych listach", yesNo(data.screeningSummary?.otherLists)],
  ] as const;
}

export function kysListRows(data: VerclyKysData) {
  return (data.screenedLists ?? []).map(entry => ({
    label: verclyListLabels[entry.name] ?? entry.name.replaceAll("_", " "),
    result: yesNo(entry.matched), matched: entry.matched,
  }));
}

/** Stored report acquisition time, never report-as-of, PDF download or render time. */
export function formatKysRetrievedAt(timestamp: string | null | undefined): string | null {
  if (!timestamp || !/(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)) return null;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(date);
}

export function capitalInThousands(input: string | null | undefined): string {
  if (!input) return "brak danych";
  const amount = Number(input.replaceAll(" ", "").replace(",", "."));
  return Number.isFinite(amount) ? `${new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount / 1000)} tys. PLN` : "brak danych";
}


export const verclyListLabels: Record<string, string> = {
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

