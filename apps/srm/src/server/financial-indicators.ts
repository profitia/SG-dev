import type { FinancialData, FinancialPeriod } from "@profitia/srm-xray";
type FinancialIndicatorResult = NonNullable<FinancialData["indicators"]>[number];

export const FINANCIAL_INDICATOR_FORMULA_VERSION = "1.2";
export const FINANCIAL_INDICATOR_CODES = [
  "CURRENT_RATIO", "NET_WORKING_CAPITAL", "LIABILITIES_TO_ASSETS", "EQUITY_TO_ASSETS",
  "OPERATING_MARGIN", "NET_MARGIN", "REVENUE_YOY", "MATERIALS_ENERGY_SHARE", "ROA", "ROE",
  "QUICK_RATIO", "EBITDA_MARGIN", "INTEREST_COVERAGE", "NET_DEBT_TO_EBITDA", "FREE_CASH_FLOW", "CASH_CONVERSION_CYCLE",
] as const;

export type CatalogIndicatorFact = {
  metricCode: string;
  periodStart: string;
  periodEnd: string;
  statementScope: "UNIT" | "CONSOLIDATED" | "UNKNOWN";
  amount: string;
  currencyCode: string | null;
  unitCode: string;
  sourcePath: string;
  validationStatus: "VALID" | "REVIEW" | "REJECTED";
  normalizationRule: string;
  sourceSnapshotId: string | null;
};

export type IndicatorEvidence = {
  metricCode: string;
  periodStart: string;
  periodEnd: string;
  amount: string;
  sourcePath: string;
  sourceSnapshotId: string;
  documentId: string;
};

export type CalculatedFinancialIndicator = FinancialIndicatorResult & {
  nip: string;
  inputFacts: IndicatorEvidence[];
  sourceSnapshotIds: string[];
  sourceDocumentIds: string[];
};

type IndicatorCode = typeof FINANCIAL_INDICATOR_CODES[number];
type Unit = FinancialIndicatorResult["unit"];
type Definition = { code: IndicatorCode; unit: Unit; importance: 1 | 2 | 3; fields: readonly string[]; prior?: string; priorFields?: readonly string[]; mappingUnconfirmed?: true };
const CCC_BALANCE_FIELDS = [
  "BS_A_CA_INV", "BS_TRADE_RECEIVABLES_RELATED", "BS_TRADE_RECEIVABLES_INVESTEE",
  "BS_TRADE_RECEIVABLES_OTHER", "BS_TRADE_PAYABLES_RELATED",
  "BS_TRADE_PAYABLES_INVESTEE", "BS_TRADE_PAYABLES_OTHER",
] as const;
const definitions: readonly Definition[] = [
  { code: "CURRENT_RATIO", unit: "RATIO", importance: 3, fields: ["BS_A_CA", "BS_LAE_LAPFL_STL"] },
  { code: "NET_WORKING_CAPITAL", unit: "PLN", importance: 2, fields: ["BS_A_CA", "BS_LAE_LAPFL_STL"] },
  { code: "LIABILITIES_TO_ASSETS", unit: "PERCENT", importance: 3, fields: ["BS_LAE_LAPFL", "BS_A_TA"] },
  { code: "EQUITY_TO_ASSETS", unit: "PERCENT", importance: 2, fields: ["BS_LAE_E", "BS_A_TA"] },
  { code: "OPERATING_MARGIN", unit: "PERCENT", importance: 3, fields: ["PALA_PLFOA", "PALA_NRFS"] },
  { code: "NET_MARGIN", unit: "PERCENT", importance: 2, fields: ["PALA_NPL", "PALA_NRFS"] },
  { code: "REVENUE_YOY", unit: "PERCENT", importance: 2, fields: ["PALA_NRFS"], prior: "PALA_NRFS" },
  { code: "MATERIALS_ENERGY_SHARE", unit: "PERCENT", importance: 1, fields: ["PALA_OAC_MAEC", "PALA_OAC"] },
  { code: "ROA", unit: "PERCENT", importance: 2, fields: ["PALA_NPL", "BS_A_TA"], prior: "BS_A_TA" },
  { code: "ROE", unit: "PERCENT", importance: 1, fields: ["PALA_NPL", "BS_LAE_E"], prior: "BS_LAE_E" },
  // Broad totals are not valid substitutes for the exact fields below.
  { code: "QUICK_RATIO", unit: "RATIO", importance: 3, fields: ["BS_A_CA", "BS_A_CA_INV", "BS_LAE_LAPFL_STL"] },
  { code: "EBITDA_MARGIN", unit: "PERCENT", importance: 2, fields: ["PALA_PLFOA", "PALA_OAC_D", "PALA_NRFS"] },
  { code: "INTEREST_COVERAGE", unit: "RATIO", importance: 3, fields: ["PALA_PLFOA", "PALA_INTEREST_EXPENSE"] },
  { code: "NET_DEBT_TO_EBITDA", unit: "RATIO", importance: 2, fields: [], mappingUnconfirmed: true },
  { code: "FREE_CASH_FLOW", unit: "PLN", importance: 3, fields: ["CFS_OPERATING_CASH_FLOW", "CFS_CAPITAL_EXPENDITURE"] },
  { code: "CASH_CONVERSION_CYCLE", unit: "DAYS", importance: 2, fields: [...CCC_BALANCE_FIELDS, "PALA_NET_SALES", "PALA_COGS"], priorFields: CCC_BALANCE_FIELDS },
];

export const FINANCIAL_INDICATOR_INPUT_CODES = [...new Set(definitions.flatMap((item) => [...item.fields, ...(item.prior ? [item.prior] : []), ...(item.priorFields ?? [])]))];

const SCALE = 10_000n;
const RESULT_SCALE = 1_000_000n;
function scaledAmount(input: string): bigint | null {
  if (!/^-?\d{1,20}(?:\.\d{1,4})?$/.test(input)) return null;
  const negative = input.startsWith("-");
  const [whole, fraction = ""] = (negative ? input.slice(1) : input).split(".");
  const value = BigInt(whole) * SCALE + BigInt(fraction.padEnd(4, "0"));
  return negative ? -value : value;
}
function decimal(value: bigint, scale: bigint, digits: number): string {
  const sign = value < 0n ? "-" : "";
  const magnitude = value < 0n ? -value : value;
  return `${sign}${magnitude / scale}.${String(magnitude % scale).padStart(digits, "0")}`;
}
function divide(numerator: bigint, denominator: bigint, multiplier: bigint): string {
  const signed = numerator * multiplier * RESULT_SCALE;
  const negative = (signed < 0n) !== (denominator < 0n);
  const quotient = ((signed < 0n ? -signed : signed) + (denominator < 0n ? -denominator : denominator) / 2n)
    / (denominator < 0n ? -denominator : denominator);
  return decimal(negative ? -quotient : quotient, RESULT_SCALE, 6);
}
function dateMs(date: string): number {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(`${date}T00:00:00Z`) : NaN;
}
function annual(period: FinancialPeriod): boolean {
  const days = (dateMs(period.to) - dateMs(period.from)) / 86_400_000 + 1;
  return Number.isInteger(days) && days >= 365 && days <= 366;
}
function comparablePrior(current: FinancialPeriod, prior: FinancialPeriod): boolean {
  return prior.scope === current.scope && annual(current) && annual(prior)
    && dateMs(prior.to) + 86_400_000 === dateMs(current.from);
}
function selectedPeriods(data: FinancialData): FinancialPeriod[] {
  const candidates = data.periods.filter((period) => Number.isFinite(dateMs(period.from)) && Number.isFinite(dateMs(period.to)) && period.from <= period.to)
    .sort((a, b) => b.to.localeCompare(a.to) || b.facts.length - a.facts.length);
  const selected = new Map<string, FinancialPeriod>();
  for (const period of candidates) {
    const key = `${period.scope}:${period.to.slice(0, 4)}`;
    const previous = selected.get(key);
    const quality = (p: FinancialPeriod) => (p.facts.some((f) => f.metricCode.startsWith("BS_"))
      && p.facts.some((f) => f.metricCode.startsWith("PALA_")) ? 100000 : 0) + p.facts.length;
    if (!previous || quality(period) > quality(previous)) selected.set(key, period);
  }
  return [...selected.values()].sort((a, b) => b.to.localeCompare(a.to));
}

function factKey(period: FinancialPeriod, code: string): string {
  return `${period.from}:${period.to}:${period.scope === "standalone" ? "UNIT" : "CONSOLIDATED"}:${code}`;
}
function indicatorFor(
  nip: string, definition: Definition, period: FinancialPeriod, prior: FinancialPeriod | undefined,
  facts: Map<string, CatalogIndicatorFact>,
): CalculatedFinancialIndicator {
  const inputs: IndicatorEvidence[] = [];
  const result: CalculatedFinancialIndicator = {
    nip, code: definition.code, periodStart: period.from, periodEnd: period.to, scope: period.scope,
    status: "UNAVAILABLE", value: null, unit: definition.unit, importance: definition.importance,
    reasonCode: "MISSING_FIELD", formulaVersion: FINANCIAL_INDICATOR_FORMULA_VERSION,
    inputFacts: inputs, sourceSnapshotIds: [], sourceDocumentIds: [],
  };
  const finish = (reasonCode: string | null, value: string | null = null): CalculatedFinancialIndicator => {
    result.reasonCode = reasonCode;
    result.value = value;
    result.status = reasonCode === null ? "AVAILABLE" : "UNAVAILABLE";
    result.sourceSnapshotIds = [...new Set(inputs.map((f) => f.sourceSnapshotId))].sort();
    result.sourceDocumentIds = [...new Set(inputs.map((f) => f.documentId))].sort();
    return result;
  };
  if (!annual(period)) return finish("PERIOD_NOT_ANNUAL");
  if (definition.mappingUnconfirmed) return finish("SOURCE_MAPPING_UNCONFIRMED");
  if ((definition.prior || definition.priorFields?.length) && !prior) return finish("PRIOR_YEAR_NOT_COMPARABLE");
  const values = new Map<string, bigint>();
  const sourcePeriods: Array<[FinancialPeriod, readonly string[]]> = [[period, definition.fields]];
  if (prior && (definition.prior || definition.priorFields?.length)) {
    sourcePeriods.push([prior, [...(definition.prior ? [definition.prior] : []), ...(definition.priorFields ?? [])]]);
  }
  for (const [sourcePeriod, codes] of sourcePeriods) {
    const currentSnapshotIds = new Set<string>();
    for (const code of codes) {
      const fact = facts.get(factKey(sourcePeriod, code));
      if (!fact) return finish("MISSING_FIELD");
      if (fact.validationStatus !== "VALID") return finish("UNVERIFIED_FIELD");
      if (fact.currencyCode !== "PLN" || fact.unitCode !== "PLN") return finish("UNSUPPORTED_UNIT");
      if ((code === "PALA_OAC" || code === "PALA_OAC_MAEC" || code === "PALA_OAC_D" || code === "PALA_COGS")
        && fact.normalizationRule !== "VERIFIED_COST_MAGNITUDE_V1") return finish("UNVERIFIED_COST_SIGN");
      if (!fact.sourceSnapshotId) return finish("UNVERIFIED_SOURCE");
      const value = scaledAmount(fact.amount);
      if (value === null) return finish("INVALID_AMOUNT");
      const displayed = sourcePeriod.facts.find((item) => item.metricCode === code);
      if (!displayed || scaledAmount(displayed.amount) !== value || displayed.currency !== "PLN" || displayed.unit !== "PLN") {
        return finish("DOCUMENT_MISMATCH");
      }
      currentSnapshotIds.add(fact.sourceSnapshotId);
      inputs.push({ metricCode: code, periodStart: sourcePeriod.from, periodEnd: sourcePeriod.to,
        amount: fact.amount, sourcePath: fact.sourcePath, sourceSnapshotId: fact.sourceSnapshotId,
        documentId: sourcePeriod.documentId });
      values.set(`${sourcePeriod.from}:${code}`, value);
    }
    if (currentSnapshotIds.size !== 1) return finish("MIXED_SOURCE");
  }
  const current = (code: string) => values.get(`${period.from}:${code}`)!;
  const previous = (code: string) => values.get(`${prior!.from}:${code}`)!;
  const percent = (num: bigint, den: bigint) => divide(num, den, 100n);
  const ratio = (num: bigint, den: bigint) => divide(num, den, 1n);
  switch (definition.code) {
    case "CURRENT_RATIO":
      return current("BS_LAE_LAPFL_STL") <= 0n ? finish("NON_POSITIVE_DENOMINATOR")
        : finish(null, ratio(current("BS_A_CA"), current("BS_LAE_LAPFL_STL")));
    case "NET_WORKING_CAPITAL":
      return finish(null, decimal(current("BS_A_CA") - current("BS_LAE_LAPFL_STL"), SCALE, 4));
    case "LIABILITIES_TO_ASSETS":
      return current("BS_A_TA") <= 0n ? finish("NON_POSITIVE_DENOMINATOR")
        : finish(null, percent(current("BS_LAE_LAPFL"), current("BS_A_TA")));
    case "EQUITY_TO_ASSETS":
      return current("BS_A_TA") <= 0n ? finish("NON_POSITIVE_DENOMINATOR")
        : finish(null, percent(current("BS_LAE_E"), current("BS_A_TA")));
    case "OPERATING_MARGIN":
      return current("PALA_NRFS") <= 0n ? finish("NON_POSITIVE_DENOMINATOR")
        : finish(null, percent(current("PALA_PLFOA"), current("PALA_NRFS")));
    case "NET_MARGIN":
      return current("PALA_NRFS") <= 0n ? finish("NON_POSITIVE_DENOMINATOR")
        : finish(null, percent(current("PALA_NPL"), current("PALA_NRFS")));
    case "REVENUE_YOY":
      return previous("PALA_NRFS") <= 0n ? finish("NON_POSITIVE_DENOMINATOR")
        : finish(null, percent(current("PALA_NRFS") - previous("PALA_NRFS"), previous("PALA_NRFS")));
    case "MATERIALS_ENERGY_SHARE":
      return current("PALA_OAC") <= 0n ? finish("NON_POSITIVE_DENOMINATOR")
        : finish(null, percent(current("PALA_OAC_MAEC"), current("PALA_OAC")));
    case "EBITDA_MARGIN": {
      const revenue = current("PALA_NRFS");
      return revenue <= 0n ? finish("NON_POSITIVE_DENOMINATOR")
        : finish(null, percent(current("PALA_PLFOA") + current("PALA_OAC_D"), revenue));
    }
    case "ROA": {
      const balance = current("BS_A_TA") + previous("BS_A_TA");
      return balance <= 0n ? finish("NON_POSITIVE_DENOMINATOR") : finish(null, percent(current("PALA_NPL") * 2n, balance));
    }
    case "QUICK_RATIO": {
      const liabilities = current("BS_LAE_LAPFL_STL");
      const inventory = current("BS_A_CA_INV");
      const assets = current("BS_A_CA");
      return liabilities <= 0n ? finish("NON_POSITIVE_DENOMINATOR")
        : inventory < 0n || inventory > assets ? finish("INVALID_AMOUNT")
          : finish(null, ratio(assets - inventory, liabilities));
    }
    case "INTEREST_COVERAGE": {
      // The provider labels this exact XML child as interest expense, but
      // source statements use both signed and unsigned cost conventions.
      const interest = current("PALA_INTEREST_EXPENSE");
      const expense = interest < 0n ? -interest : interest;
      return expense === 0n ? finish("NON_POSITIVE_DENOMINATOR")
        : finish(null, ratio(current("PALA_PLFOA"), expense));
    }
    case "FREE_CASH_FLOW": {
      const capex = current("CFS_CAPITAL_EXPENDITURE");
      const outflow = capex < 0n ? -capex : capex;
      return finish(null, decimal(current("CFS_OPERATING_CASH_FLOW") - outflow, SCALE, 4));
    }
    case "CASH_CONVERSION_CYCLE": {
      const receivables = (read: (code: string) => bigint) =>
        read("BS_TRADE_RECEIVABLES_RELATED") + read("BS_TRADE_RECEIVABLES_INVESTEE") + read("BS_TRADE_RECEIVABLES_OTHER");
      const payables = (read: (code: string) => bigint) =>
        read("BS_TRADE_PAYABLES_RELATED") + read("BS_TRADE_PAYABLES_INVESTEE") + read("BS_TRADE_PAYABLES_OTHER");
      if ([...CCC_BALANCE_FIELDS].some((code) => current(code) < 0n || previous(code) < 0n)) return finish("INVALID_AMOUNT");
      const sales = current("PALA_NET_SALES"), cogs = current("PALA_COGS");
      if (sales <= 0n || cogs <= 0n) return finish("NON_POSITIVE_DENOMINATOR");
      const days = BigInt((dateMs(period.to) - dateMs(period.from)) / 86_400_000 + 1);
      const stockAndPayables = current("BS_A_CA_INV") + previous("BS_A_CA_INV") - payables(current) - payables(previous);
      const tradeReceivables = receivables(current) + receivables(previous);
      return finish(null, ratio(days * (stockAndPayables * sales + tradeReceivables * cogs), 2n * cogs * sales));
    }
    case "NET_DEBT_TO_EBITDA":
      return finish("SOURCE_MAPPING_UNCONFIRMED");
    case "ROE": {
      const equity = current("BS_LAE_E") + previous("BS_LAE_E");
      return equity <= 0n ? finish("NON_POSITIVE_EQUITY") : finish(null, percent(current("PALA_NPL") * 2n, equity));
    }
  }
}

/** Deterministic server calculation from the already persisted, validated catalog. */
export function calculateFinancialIndicators(nip: string, data: FinancialData, catalogFacts: readonly CatalogIndicatorFact[]): CalculatedFinancialIndicator[] {
  const facts = new Map(catalogFacts.map((fact) => [
    `${fact.periodStart}:${fact.periodEnd}:${fact.statementScope}:${fact.metricCode}`, fact,
  ]));
  const periods = selectedPeriods(data);
  return periods.flatMap((period) => {
    const prior = periods.find((candidate) => comparablePrior(period, candidate));
    return definitions.map((definition) => indicatorFor(nip, definition, period, prior, facts));
  });
}
