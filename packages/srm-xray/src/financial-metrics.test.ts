import { calculateReportMetrics, type CalculationFact } from "./financial-metrics";

const period = { periodStart: "2025-01-01", periodEnd: "2025-12-31", scope: "UNIT" as const };
function fact(code: CalculationFact["code"], amount: string, year = 2025, extra: Partial<CalculationFact> = {}): CalculationFact {
  return { code, amount, currency: "PLN", unit: "PLN", periodStart: year + "-01-01", periodEnd: year + "-12-31",
    scope: "UNIT", documentId: "doc-" + year, sourcePath: "content.standardized_fields." + code,
    mappingVersion: "test-fixture-1", mappingStatus: "VERIFIED", ...extra };
}
function expect(condition: boolean, message: string): void { if (!condition) throw new Error(message); }
function result(facts: CalculationFact[], code: string) {
  const found = calculateReportMetrics(facts, period).find(item => item.code === code);
  if (!found) throw new Error("Missing result " + code);
  return found;
}
const complete = [fact("REVENUE_NET", "1200"), fact("REVENUE_NET", "1000", 2024),
  fact("NET_PROFIT", "-120"), fact("CURRENT_ASSETS", "300"), fact("CURRENT_LIABILITIES", "150"),
  fact("TOTAL_LIABILITIES", "500"), fact("TOTAL_ASSETS", "1000"), fact("OPERATING_CASH_FLOW", "60")];
expect(result(complete, "REVENUE_GROWTH_YOY_PCT").value === "20.00", "YoY revenue must compare matching years");
expect(result(complete, "NET_MARGIN_PCT").value === "-10.00", "Negative profit remains a valid negative margin");
expect(result(complete, "CURRENT_RATIO").value === "2.00", "Current ratio must retain two decimals");
expect(result(complete, "LIABILITIES_TO_ASSETS_PCT").value === "50.00", "Liabilities ratio uses total assets");
expect(result(complete, "OPERATING_CASH_FLOW_TO_REVENUE_PCT").value === "5.00", "Cash flow uses the same period");
expect(result(complete.filter(item => item.periodEnd !== "2024-12-31"), "REVENUE_GROWTH_YOY_PCT").reason === "MISSING_PREVIOUS_PERIOD", "Missing prior year is not zero growth");
expect(result([fact("REVENUE_NET", "0"), fact("NET_PROFIT", "5")], "NET_MARGIN_PCT").reason === "ZERO_OR_NEGATIVE_BASE", "Zero denominator must not produce a value");
expect(result([fact("REVENUE_NET", "100"), fact("NET_PROFIT", "5", 2025, { mappingStatus: "UNVERIFIED" })], "NET_MARGIN_PCT").reason === "UNVERIFIED_MAPPING", "Unverified provider field must not be calculated");
expect(result([...complete, fact("REVENUE_NET", "900")], "NET_MARGIN_PCT").reason === "AMBIGUOUS_INPUT", "Correction selection must precede calculation");
expect(result([fact("REVENUE_NET", "100"), fact("NET_PROFIT", "5", 2025, { currency: "EUR" })], "NET_MARGIN_PCT").reason === "INCOMPARABLE_INPUT", "Currencies may not be mixed");
expect(result([fact("REVENUE_NET", "100"), fact("NET_PROFIT", "5.12345")], "NET_MARGIN_PCT").reason === "INVALID_AMOUNT", "Unsupported precision must fail closed");


const leap = calculateReportMetrics([fact("REVENUE_NET", "100", 2024, { periodStart: "2024-02-29" })],
  { periodStart: "2024-02-29", periodEnd: "2024-12-31", scope: "UNIT" });
expect(leap.find(item => item.code === "REVENUE_GROWTH_YOY_PCT")?.reason === "MISSING_PREVIOUS_PERIOD", "Invalid prior leap date must not be normalized");
console.log("financial metrics: 11 assertions passed");
