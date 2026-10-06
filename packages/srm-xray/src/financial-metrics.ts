/** Report-only financial analysis. Provider field bindings are approved separately. */
export type CanonicalFinancialCode =
  | "REVENUE_NET" | "NET_PROFIT" | "CURRENT_ASSETS" | "CURRENT_LIABILITIES"
  | "TOTAL_ASSETS" | "TOTAL_LIABILITIES" | "OPERATING_CASH_FLOW";

export type FinancialMetricCode =
  | "REVENUE_GROWTH_YOY_PCT" | "NET_MARGIN_PCT" | "CURRENT_RATIO"
  | "LIABILITIES_TO_ASSETS_PCT" | "OPERATING_CASH_FLOW_TO_REVENUE_PCT";

export type CalculationFact = {
  code: CanonicalFinancialCode;
  amount: string;
  currency: string;
  unit: string;
  periodStart: string;
  periodEnd: string;
  scope: "UNIT" | "CONSOLIDATED";
  documentId: string;
  sourcePath: string;
  mappingVersion: string;
  mappingStatus: "VERIFIED" | "UNVERIFIED";
};

export type CalculationContext = Pick<CalculationFact, "periodStart" | "periodEnd" | "scope">;
export type MetricUnavailableReason =
  | "MISSING_INPUT" | "UNVERIFIED_MAPPING" | "AMBIGUOUS_INPUT" | "INVALID_AMOUNT"
  | "INCOMPARABLE_INPUT" | "ZERO_OR_NEGATIVE_BASE" | "MISSING_PREVIOUS_PERIOD";
export type MetricResult = {
  code: FinancialMetricCode;
  definitionVersion: "1.0";
  status: "CALCULATED" | "UNAVAILABLE";
  value: string | null;
  unit: "%" | "x";
  reason: MetricUnavailableReason | null;
  inputs: readonly CalculationFact[];
};

export const FINANCIAL_METRIC_DEFINITIONS = [
  { code: "REVENUE_GROWTH_YOY_PCT", label: "Zmiana przychodów rok do roku", formula: "(revenue_current / revenue_previous - 1) * 100", required: ["REVENUE_NET"] },
  { code: "NET_MARGIN_PCT", label: "Marża netto", formula: "net_profit / revenue_net * 100", required: ["NET_PROFIT", "REVENUE_NET"] },
  { code: "CURRENT_RATIO", label: "Płynność bieżąca", formula: "current_assets / current_liabilities", required: ["CURRENT_ASSETS", "CURRENT_LIABILITIES"] },
  { code: "LIABILITIES_TO_ASSETS_PCT", label: "Udział zobowiązań w aktywach", formula: "total_liabilities / total_assets * 100", required: ["TOTAL_LIABILITIES", "TOTAL_ASSETS"] },
  { code: "OPERATING_CASH_FLOW_TO_REVENUE_PCT", label: "Przepływy operacyjne do przychodów", formula: "operating_cash_flow / revenue_net * 100", required: ["OPERATING_CASH_FLOW", "REVENUE_NET"] },
] as const;

const SCALE = 10_000n;
function parseAmount(value: string): bigint | null {
  const match = /^([+-]?)(\d+)(?:\.(\d{1,4}))?$/.exec(value);
  if (!match) return null;
  const magnitude = BigInt(match[2]) * SCALE + BigInt((match[3] ?? "").padEnd(4, "0") || "0");
  return match[1] === "-" ? -magnitude : magnitude;
}
function formatQuotient(numerator: bigint, denominator: bigint, percent: boolean): string {
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const factor = percent ? 10_000n : 100n; // two displayed decimals
  const rounded = (absolute * factor + denominator / 2n) / denominator;
  return (negative && rounded !== 0n ? "-" : "") + String(rounded / 100n) + "." + String(rounded % 100n).padStart(2, "0");
}
function priorDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const previous = String(Number(value.slice(0, 4)) - 1).padStart(4, "0") + value.slice(4);
  const parsed = new Date(previous + "T00:00:00Z");
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== previous ? null : previous;
}
function pick(facts: readonly CalculationFact[], code: CanonicalFinancialCode, period: CalculationContext):
  { fact: CalculationFact | null; reason: MetricUnavailableReason | null } {
  const candidates = facts.filter(f => f.code === code && f.periodStart === period.periodStart && f.periodEnd === period.periodEnd && f.scope === period.scope);
  const verified = candidates.filter(f => f.mappingStatus === "VERIFIED" && f.sourcePath && f.documentId && f.mappingVersion);
  if (verified.length > 1) return { fact: null, reason: "AMBIGUOUS_INPUT" };
  if (verified.length === 1) return { fact: verified[0], reason: null };
  return { fact: null, reason: candidates.length ? "UNVERIFIED_MAPPING" : "MISSING_INPUT" };
}
function calculateOne(
  code: FinancialMetricCode, facts: readonly CalculationFact[], period: CalculationContext,
): MetricResult {
  const unit = code === "CURRENT_RATIO" ? "x" : "%";
  const unavailable = (reason: MetricUnavailableReason, inputs: readonly CalculationFact[] = []): MetricResult =>
    ({ code, definitionVersion: "1.0", status: "UNAVAILABLE", value: null, unit, reason, inputs });
  let numeratorCode: CanonicalFinancialCode;
  let denominatorCode: CanonicalFinancialCode;
  switch (code) {
    case "REVENUE_GROWTH_YOY_PCT": numeratorCode = "REVENUE_NET"; denominatorCode = "REVENUE_NET"; break;
    case "NET_MARGIN_PCT": numeratorCode = "NET_PROFIT"; denominatorCode = "REVENUE_NET"; break;
    case "CURRENT_RATIO": numeratorCode = "CURRENT_ASSETS"; denominatorCode = "CURRENT_LIABILITIES"; break;
    case "LIABILITIES_TO_ASSETS_PCT": numeratorCode = "TOTAL_LIABILITIES"; denominatorCode = "TOTAL_ASSETS"; break;
    case "OPERATING_CASH_FLOW_TO_REVENUE_PCT": numeratorCode = "OPERATING_CASH_FLOW"; denominatorCode = "REVENUE_NET"; break;
  }
  const numerator = pick(facts, numeratorCode, period);
  if (!numerator.fact) return unavailable(numerator.reason!);
  const denominatorPeriod = code === "REVENUE_GROWTH_YOY_PCT"
    ? { periodStart: priorDate(period.periodStart), periodEnd: priorDate(period.periodEnd), scope: period.scope }
    : period;
  if (!denominatorPeriod.periodStart || !denominatorPeriod.periodEnd) return unavailable("MISSING_PREVIOUS_PERIOD", [numerator.fact]);
  const denominator = pick(facts, denominatorCode, denominatorPeriod as CalculationContext);
  if (!denominator.fact) return unavailable(code === "REVENUE_GROWTH_YOY_PCT" && denominator.reason === "MISSING_INPUT" ? "MISSING_PREVIOUS_PERIOD" : denominator.reason!, [numerator.fact]);
  const inputs = [numerator.fact, denominator.fact];
  if (inputs[0].currency !== inputs[1].currency || inputs[0].unit !== inputs[1].unit) return unavailable("INCOMPARABLE_INPUT", inputs);
  const a = parseAmount(inputs[0].amount);
  const b = parseAmount(inputs[1].amount);
  if (a === null || b === null) return unavailable("INVALID_AMOUNT", inputs);
  if (b <= 0n) return unavailable("ZERO_OR_NEGATIVE_BASE", inputs);
  const value = formatQuotient(code === "REVENUE_GROWTH_YOY_PCT" ? a - b : a, b, unit === "%");
  return { code, definitionVersion: "1.0", status: "CALCULATED", value, unit, reason: null, inputs };
}

export function calculateReportMetrics(facts: readonly CalculationFact[], period: CalculationContext): readonly MetricResult[] {
  return FINANCIAL_METRIC_DEFINITIONS.map(definition => calculateOne(definition.code, facts, period));
}
