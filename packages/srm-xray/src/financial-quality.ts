import type { FinancialPeriod } from "./contracts";
export const FINANCIAL_QUALITY_RULE = "FINANCIAL_QUALITY_V1";
export type FinancialQualityCode = "BALANCE_INCONSISTENT" | "RESTATEMENT_UNRESOLVED" | "UNIT_UNCONFIRMED";
export const financialQualityLabels: Record<FinancialQualityCode, string> = {
  BALANCE_INCONSISTENT: "Sumy bilansu są niespójne. Powiązane wyliczenia zostały wstrzymane; zachowano kwoty źródłowe.",
  RESTATEMENT_UNRESOLVED: "Dane porównawcze mają nieuzgodnioną wersję przekształconą. Nie łączymy obu wersji w obliczeniach.",
  UNIT_UNCONFIRMED: "Nie potwierdzono jednostki części kwot. Nie są one przeliczane ani używane w obliczeniach.",
};
const amount = (text: string): bigint | null => {
  if (!/^-?\d{1,20}(?:\.\d{1,4})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.replace(/^-/, "").split(".");
  return (BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, "0"))) * (text.startsWith("-") ? -1n : 1n);
};
/** Recomputed on reads too: stale cached AVAILABLE results cannot bypass quality. */
export function financialQualityIssues(period: Pick<FinancialPeriod, "facts" | "comparativeData">): FinancialQualityCode[] {
  const issues: FinancialQualityCode[] = [];
  const totals = ["BS_A_TA", "BS_LAE_E", "BS_LAE_LAPFL"].map(code => period.facts.filter(f => f.metricCode === code));
  if (totals.every(values => values.length === 1 && values[0].currency === "PLN" && values[0].unit === "PLN")) {
    const values = totals.map(v => amount(v[0].amount));
    if (values.every((v): v is bigint => v !== null)) {
      const delta = values[0] - values[1] - values[2];
      if (delta > 100n || delta < -100n) issues.push("BALANCE_INCONSISTENT");
    }
  }
  if (period.comparativeData?.selected === "UNRESOLVED") issues.push("RESTATEMENT_UNRESOLVED");
  if (period.facts.some(f => f.unit === "UNKNOWN")) issues.push("UNIT_UNCONFIRMED");
  return issues;
}
export function financialQualityReason(period: Pick<FinancialPeriod, "facts" | "comparativeData">, codes: readonly string[]): FinancialQualityCode | null {
  const issues = financialQualityIssues(period);
  if (issues.includes("RESTATEMENT_UNRESOLVED")) return "RESTATEMENT_UNRESOLVED";
  if (issues.includes("BALANCE_INCONSISTENT") && codes.some(code => code.startsWith("BS_"))) return "BALANCE_INCONSISTENT";
  if (period.facts.some(f => codes.includes(f.metricCode) && f.unit === "UNKNOWN")) return "UNIT_UNCONFIRMED";
  return null;
}
