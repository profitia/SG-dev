import type { FinancialData, FinancialPeriod, SectionEnvelope } from "@profitia/srm-xray";
import type { CompanyIdentifier, MgbiGeneralOptions } from "./mgbi-general";

type RecordObject = Record<string, unknown>;
export type FinancialSourceFact = {
  metricCode: string;
  periodStart: string;
  periodEnd: string;
  periodType: "YEAR" | "QUARTER" | "MONTH" | "OTHER";
  statementScope: "UNIT" | "CONSOLIDATED";
  amount: string;
  sourceAmount: string;
  normalizationRule: "SOURCE_VALUE" | "VERIFIED_COST_MAGNITUDE_V1" | "UNVERIFIED_COST_SIGN";
  currencyCode: string;
  unitCode: string;
  sourcePath: string;
  validationStatus: "VALID" | "REVIEW";
};
export type MgbiFinancialResult = {
  section: SectionEnvelope<FinancialData>;
  sourceData?: FinancialData;
  facts: FinancialSourceFact[];
  errorCode: string | null;
};

const MODEL = "pl-krs-rdf-record";
const SOURCE = { provider: "MGBI" as const, model: MODEL, recordId: null };
const MAX_RESULTS = 100;
const NO_FINANCIAL_FACTS = "MGBI_NO_STRUCTURED_FINANCIAL_DATA";
const INTERNATIONAL_STATEMENT = "MGBI_INTERNATIONAL_STATEMENT_WITHOUT_FACTS";
const XML_FINANCIAL_FIELDS: Record<string, string> = {
  "Bilans.Aktywa.Aktywa_B.Aktywa_B_I": "BS_A_CA_INV",
  "RZiS.RZiSPor.H.H_I": "PALA_INTEREST_EXPENSE",
  "RZiS.RZiSKalk.K.K_I": "PALA_INTEREST_EXPENSE",
  "RachPrzeplywow.PrzeplywyPosr.A.A_III": "CFS_OPERATING_CASH_FLOW",
  "RachPrzeplywow.PrzeplywyBezp.A.A_III": "CFS_OPERATING_CASH_FLOW",
  "RachPrzeplywow.PrzeplywyPosr.B.B_II.B_II_1": "CFS_CAPITAL_EXPENDITURE",
  "RachPrzeplywow.PrzeplywyBezp.B.B_II.B_II_1": "CFS_CAPITAL_EXPENDITURE",
};

function obj(value: unknown): RecordObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordObject : null;
}
function field(value: unknown, ...path: string[]): unknown {
  return path.reduce<unknown>((current, key) => obj(current)?.[key], value);
}
function string(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function date(value: unknown): string | null {
  const text = string(value);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text)) ? text : null;
}
function previousYear(value: string): string {
  const year = Number(value.slice(0, 4)) - 1;
  const monthDay = value.slice(4);
  return `${year}${monthDay === "-02-29" && !((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? "-02-28" : monthDay}`;
}
function amount(value: unknown): string | null {
  const text = typeof value === "number" && Number.isFinite(value) ? String(value) : string(value);
  if (!text || !/^-?\d{1,20}(?:\.\d{1,4})?$/.test(text)) return null;
  return text;
}
function empty(status: "EMPTY" | "ERROR", at: string, warning: string, errorCode: string | null): MgbiFinancialResult {
  return { section: { status, source: SOURCE, retrievedAt: at, effectiveAt: null, data: null, warnings: [warning] }, facts: [], errorCode };
}

function scaledAmount(value: string): bigint {
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const result = BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, "0"));
  return negative ? -result : result;
}

function reconcileCosts(periods: FinancialPeriod[], facts: FinancialSourceFact[]): boolean {
  let unverified = false;
  for (const period of periods) {
    const values = new Map(period.facts.map((fact) => [fact.metricCode, fact.amount]));
    const equations = [
      { cost: "PALA_OAC", left: "PALA_NRFS", addition: null, result: "PALA_PLFS" },
      { cost: "PALA_OOC", left: "PALA_PLFS", addition: "PALA_OOR", result: "PALA_PLFOA" },
      { cost: "PALA_FC", left: "PALA_PLFOA", addition: "PALA_FR", result: "PALA_GPL" },
      { cost: "PALA_IT", left: "PALA_GPL", addition: null, result: "PALA_NPL" },
    ] as const;
    for (const equation of equations) {
      const sourceCost = values.get(equation.cost);
      if (sourceCost === undefined) continue;
      const left = values.get(equation.left);
      const addition = equation.addition === null ? "0" : values.get(equation.addition);
      const result = values.get(equation.result);
      const costValue = scaledAmount(sourceCost);
      // Compare only values from the same document, period and statement scope.
      // One grosz covers decimal rounding in source reports, not a material mismatch.
      const verified = left !== undefined && addition !== undefined && result !== undefined && (
        (costValue < 0n && abs(scaledAmount(left) + scaledAmount(addition) + costValue - scaledAmount(result)) <= 100n) ||
        (costValue >= 0n && abs(scaledAmount(left) + scaledAmount(addition) - costValue - scaledAmount(result)) <= 100n)
      );
      if (!verified) unverified = true;
      for (const displayFact of period.facts) {
        if (displayFact.metricCode !== equation.cost && !(equation.cost === "PALA_OAC" && displayFact.metricCode.startsWith("PALA_OAC_"))) continue;
        const stored = facts.find((fact) => fact.metricCode === displayFact.metricCode && fact.periodStart === period.from
          && fact.periodEnd === period.to && fact.statementScope === (period.scope === "standalone" ? "UNIT" : "CONSOLIDATED"));
        if (!stored) continue;
        const sameSign = scaledAmount(stored.sourceAmount) === 0n || (scaledAmount(stored.sourceAmount) < 0n) === (costValue < 0n);
        if (!verified || !sameSign) {
          stored.normalizationRule = "UNVERIFIED_COST_SIGN";
          stored.validationStatus = "REVIEW";
          unverified = true;
          continue;
        }
        stored.amount = stored.sourceAmount.replace(/^-/, "");
        stored.normalizationRule = "VERIFIED_COST_MAGNITUDE_V1";
        displayFact.amount = stored.amount;
      }
    }
  }
  return unverified;
}

function abs(value: bigint): bigint { return value < 0n ? -value : value; }

function isInternationalStatementWithoutFacts(records: unknown[], identifier: CompanyIdentifier, totalCount: number): boolean {
  // A partial page cannot prove that every available statement follows the same standard.
  if (totalCount > records.length) return false;
  const idKey = identifier.type === "KRS" ? "pl_krs" : "pl_nip";
  const statements = records.filter((record) => {
    const type = field(record, "document", "type");
    return string(field(record, "identifiers", idKey)) === identifier.value
      && (type === "financial_statement" || type === "consolidated_financial_statement");
  });
  return statements.length > 0 && statements.every((record) => field(record, "document", "is_ias_compliant") === true);
}

export function mapMgbiFinancialRecords(records: unknown[], identifier: CompanyIdentifier, retrievedAt: string, totalCount = records.length): MgbiFinancialResult {
  const idKey = identifier.type === "KRS" ? "pl_krs" : "pl_nip";
  const matching = records.filter((record) => string(field(record, "identifiers", idKey)) === identifier.value);
  if (records.length && !matching.length) return empty("ERROR", retrievedAt, "MGBI_IDENTIFIER_MISMATCH", "IDENTIFIER_MISMATCH");
  const selected = matching.filter((record) => {
    const type = string(field(record, "document", "type"));
    return type === "financial_statement" || type === "consolidated_financial_statement";
  }).sort((a, b) => (string(field(b, "document", "period_to_date")) ?? "").localeCompare(string(field(a, "document", "period_to_date")) ?? ""));

  const periods: FinancialPeriod[] = [];
  const facts: FinancialSourceFact[] = [];
  const seen = new Set<string>();
  for (const record of selected) {
    const document = obj(field(record, "document"));
    const standardized = obj(field(record, "content", "standardized_fields"));
    const extracted = obj(field(record, "content", "extracted_fields"));
    const from = date(document?.period_from_date);
    const to = date(document?.period_to_date);
    const recordId = string(field(record, "id"));
    if ((!standardized && !extracted) || !from || !to || !recordId || from > to) continue;
    const scope = document?.type === "consolidated_financial_statement" ? "CONSOLIDATED" : "UNIT";
    const schema = string(field(record, "content", "schema", "name")) ?? "";
    const unitCode = /wtysiacachzlotych/i.test(schema) ? "THOUSAND_PLN" : /wzlotych/i.test(schema) ? "PLN" : "UNKNOWN";
    const validationStatus = unitCode === "PLN" ? "VALID" : "REVIEW";
    const byPeriod = new Map<string, FinancialPeriod>();
    // MGBI defines extracted_fields as the complete XML field dictionary and
    // standardized_fields as its smaller comparable subset. Preserve the subset
    // as authority when both dictionaries contain the same metric and period.
    for (const [dictionaryName, dictionary] of [["standardized_fields", standardized], ["extracted_fields", extracted]] as const) {
      if (!dictionary) continue;
      if (dictionaryName === "extracted_fields") {
        // MGBI returns a flat XML path-to-amount map. Persist only audited
        // financial paths; other extracted fields may contain personal data.
        for (const [xmlPath, rawValue] of Object.entries(dictionary)) {
          const match = /^(.*)\.Kwota([AB])$/.exec(xmlPath);
          const metricCode = match ? XML_FINANCIAL_FIELDS[match[1]] : undefined;
          const numeric = amount(rawValue);
          if (!metricCode || numeric === null) continue;
          const prior = match![2] === "B";
          const periodStart = prior ? previousYear(from) : from;
          const periodEnd = prior ? previousYear(to) : to;
          const unique = [scope, periodStart, periodEnd, metricCode].join(":");
          if (seen.has(unique)) continue;
          seen.add(unique);
          const periodType = periodStart.slice(0, 4) === periodEnd.slice(0, 4) && periodStart.endsWith("-01-01") && periodEnd.endsWith("-12-31") ? "YEAR" : "OTHER";
          facts.push({ metricCode, periodStart, periodEnd, periodType, statementScope: scope,
            amount: numeric, sourceAmount: numeric, normalizationRule: "SOURCE_VALUE", currencyCode: "PLN", unitCode,
            sourcePath: "content.extracted_fields." + xmlPath, validationStatus });
          const key = recordId + ":" + (prior ? "pfy" : "cfy");
          let period = byPeriod.get(key);
          if (!period) {
            period = { from: periodStart, to: periodEnd, scope: scope === "UNIT" ? "standalone" : "consolidated", documentId: key, facts: [] };
            byPeriod.set(key, period);
            periods.push(period);
          }
          (period.facts as { metricCode: string; amount: string; currency: string; unit: string }[]).push({ metricCode, amount: numeric, currency: "PLN", unit: unitCode });
        }
      }
      for (const [sectionName, sectionFields] of Object.entries(dictionary)) {
      const section = obj(sectionFields);
      if (!section || !/^[a-z]{2,8}$/.test(sectionName)) continue;
      for (const [sourceKey, rawValue] of Object.entries(section)) {
        const match = /^([a-z][a-z0-9_]{0,70})_(cfy|pfy)$/.exec(sourceKey);
        const numeric = amount(rawValue);
        if (!match || numeric === null) continue;
        const prior = match[2] === "pfy";
        const periodStart = prior ? previousYear(from) : from;
        const periodEnd = prior ? previousYear(to) : to;
        const metricCode = `${sectionName}_${match[1]}`.toUpperCase();
        if (metricCode.length > 80) continue;
        const unique = `${scope}:${periodStart}:${periodEnd}:${metricCode}`;
        if (seen.has(unique)) continue;
        seen.add(unique);
        const periodType = periodStart.slice(0, 4) === periodEnd.slice(0, 4) && periodStart.endsWith("-01-01") && periodEnd.endsWith("-12-31") ? "YEAR" : "OTHER";
        const fact: FinancialSourceFact = {
          metricCode, periodStart, periodEnd, periodType, statementScope: scope,
          amount: numeric, sourceAmount: numeric, normalizationRule: "SOURCE_VALUE", currencyCode: "PLN", unitCode,
          sourcePath: `content.${dictionaryName}.${sectionName}.${sourceKey}`,
          validationStatus,
        };
        facts.push(fact);
        const key = `${recordId}:${prior ? "pfy" : "cfy"}`;
        let period = byPeriod.get(key);
        if (!period) {
          period = { from: periodStart, to: periodEnd, scope: scope === "UNIT" ? "standalone" : "consolidated", documentId: key, facts: [] };
          byPeriod.set(key, period);
          periods.push(period);
        }
        (period.facts as { metricCode: string; amount: string; currency: string; unit: string }[]).push({ metricCode, amount: numeric, currency: "PLN", unit: unitCode });
      }
      }
    }
  }
  if (!facts.length) return empty("EMPTY", retrievedAt, NO_FINANCIAL_FACTS, null);
  const sourceData: FinancialData = structuredClone({ periods });
  const unverifiedCosts = reconcileCosts(periods, facts);
  const incomplete = totalCount > records.length;
  return {
    section: {
      status: incomplete ? "PARTIAL" : "SUCCESS",
      source: { ...SOURCE, recordId: string(field(selected[0], "id")) },
      retrievedAt,
      effectiveAt: date(field(selected[0], "document", "period_to_date")),
      data: { periods },
      warnings: [...(incomplete ? ["MGBI_SEARCH_RESULT_LIMIT"] : []), ...(unverifiedCosts ? ["MGBI_COST_SIGN_UNVERIFIED"] : [])],
    },
    sourceData,
    facts,
    errorCode: null,
  };
}

export async function fetchMgbiFinancial(identifier: CompanyIdentifier, options: MgbiGeneralOptions = {}): Promise<MgbiFinancialResult> {
  if (!/^[0-9]{10}$/.test(identifier.value) || (identifier.type !== "NIP" && identifier.type !== "KRS")) throw new Error("A valid ten-digit NIP or KRS is required");
  const key = options.apiKey ?? process.env.MGBI_API_KEY;
  if (!key?.trim()) throw new Error("MGBI_API_KEY is required");
  const scheme = options.authScheme ?? (process.env.MGBI_AUTH_SCHEME === "bearer" ? "bearer" : "raw");
  const url = new URL(`/v1/models/${MODEL}/records`, options.baseUrl ?? "https://api.mgbi.pl");
  url.searchParams.set(identifier.type === "NIP" ? "identifiers.pl_nip" : "identifiers.pl_krs", identifier.value);
  url.searchParams.set("content.standardized_fields.is_available", "true");
  url.searchParams.set("per_page", String(MAX_RESULTS));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
  const now = options.now ?? (() => new Date());
  try {
    const response = await (options.fetcher ?? fetch)(url, {
      method: "GET", headers: { Accept: "application/json", Authorization: scheme === "bearer" ? `Bearer ${key.trim()}` : key.trim() },
      signal: controller.signal, cache: "no-store",
    });
    const retrievedAt = now().toISOString();
    if (!response.ok) return empty("ERROR", retrievedAt, `MGBI_HTTP_${response.status}`, `HTTP_${response.status}`);
    let body: unknown;
    try { body = await response.json(); } catch { return empty("ERROR", retrievedAt, "MGBI_INVALID_JSON", "INVALID_JSON"); }
    const results = obj(body)?.results;
    if (!Array.isArray(results)) return empty("ERROR", retrievedAt, "MGBI_INVALID_RESPONSE", "INVALID_RESPONSE");
    const count = typeof obj(body)?.count === "number" ? obj(body)!.count as number : results.length;
    const mapped = mapMgbiFinancialRecords(results, identifier, retrievedAt, count);
    if (mapped.section.status !== "EMPTY") return mapped;

    // The structured-fields filter excludes reports whose metadata is still available.
    // Inspect that metadata only for empty results; never request a paid file or record-by-id endpoint.
    const metadataUrl = new URL(url);
    metadataUrl.searchParams.delete("content.standardized_fields.is_available");
    try {
      const metadataResponse = await (options.fetcher ?? fetch)(metadataUrl, {
        method: "GET", headers: { Accept: "application/json", Authorization: scheme === "bearer" ? `Bearer ${key.trim()}` : key.trim() },
        signal: controller.signal, cache: "no-store",
      });
      if (!metadataResponse.ok) return mapped;
      const metadataBody: unknown = await metadataResponse.json();
      const metadataRecords = obj(metadataBody)?.results;
      if (!Array.isArray(metadataRecords)) return mapped;
      const metadataCount = typeof obj(metadataBody)?.count === "number" ? obj(metadataBody)!.count as number : metadataRecords.length;
      const metadataMapped = mapMgbiFinancialRecords(metadataRecords, identifier, retrievedAt, metadataCount);
      if (metadataMapped.section.status !== "EMPTY") return metadataMapped;
      return isInternationalStatementWithoutFacts(metadataRecords, identifier, metadataCount)
        ? empty("EMPTY", retrievedAt, INTERNATIONAL_STATEMENT, null)
        : mapped;
    } catch {
      // Metadata only refines the empty-state reason; losing it must not hide the known result.
      return mapped;
    }
  } catch (error) {
    const timeout = controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
    return empty("ERROR", now().toISOString(), timeout ? "MGBI_TIMEOUT" : "MGBI_NETWORK_ERROR", timeout ? "TIMEOUT" : "NETWORK_ERROR");
  } finally { clearTimeout(timer); }
}
