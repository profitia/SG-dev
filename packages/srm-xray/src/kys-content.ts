// Shared existing display semantics for the full KYS view and its document export.
export function value(text: string | null | undefined): string {
  return text == null || text === "" ? "brak danych" : text;
}


export function warningLabel(code: string): string {
  if (code === "FINANCIAL_NO_STRUCTURED_DATA") return "Nie mamy obecnie kwot finansowych do wyświetlenia dla tej firmy.";
  if (code === "FINANCIAL_INTERNATIONAL_STANDARD_UNAVAILABLE") return "Sprawozdanie finansowe jest dostępne, ale w obecnym zakresie danych nie możemy pokazać jego kwot. Sporządzono je według międzynarodowych standardów rachunkowości.";
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

