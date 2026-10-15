import type { FinancialPeriod, SupplierReportData } from "./contracts";

export type MsrReportingState = {
  notice: string;
  year: string | null;
  values: readonly { code: "REVENUE" | "NET_RESULT"; label: string; amount: string; currency: string }[];
};

/** Source presentation only. This never qualifies an IFRS observation for UoR scoring,
 * computes a financial formula, or substitutes a consolidated statement for an entity. */
export function msrReportingState(
  financial: SupplierReportData["financial"] | null | undefined,
  scope: FinancialPeriod["scope"],
  selected?: { from: string; to: string },
): MsrReportingState | null {
  const periods = financial?.periods ?? [];
  if (!periods.some(p => p.accountingStandard === "IAS_IFRS")) return null;
  const own = periods.filter(p => p.scope === scope);
  const period = selected ? own.find(p => p.from === selected.from && p.to === selected.to)
    : own.slice().sort((a, b) => b.to.localeCompare(a.to))[0];
  if (period && period.accountingStandard !== "IAS_IFRS") return null;
  if (!period) return {
    year: null, values: [],
    notice: scope === "standalone"
      ? "Brak dostępnych danych jednostkowych w obsługiwanym formacie. Dostępne są dane skonsolidowane MSR/MSSF — wybierz Skonsolidowane. Dane grupy nie zastępują danych spółki."
      : "Brak dostępnych danych skonsolidowanych w obsługiwanym formacie. Dostępne sprawozdania znajdziesz w szczegółach danych finansowych.",
  };
  const values: MsrReportingState["values"][number][] = [];
  for (const [metric, code, label] of [
    ["MSR_REVENUE", "REVENUE", "Przychody MSR/MSSF"],
    ["PALA_NPL", "NET_RESULT", "Wynik netto"],
  ] as const) {
    const facts = period.facts.filter(f => f.metricCode === metric);
    const fact = facts[0];
    if (facts.length === 1 && fact.validation === "VERIFIED" && fact.documentRef === period.documentRef
        && fact.periodStart === period.from && fact.periodEnd === period.to && fact.scope === scope
        && fact.currency === "PLN" && fact.unit === "PLN" && /^-?\d{1,24}(?:\.\d{1,6})?$/.test(fact.amount))
      values.push({ code, label, amount: fact.amount, currency: fact.currency });
  }
  return { year: period.year, values,
    notice: "Dane MSR/MSSF. Radar porównuje zweryfikowane pozycje w tym samym zakresie sprawozdania. Brak wymaganej pozycji lub niepotwierdzone mapowanie wyłącza tylko zależne od niej wskaźniki.",
  };
}
