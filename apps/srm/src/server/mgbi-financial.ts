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
  currencyCode: string;
  unitCode: string;
  sourcePath: string;
  validationStatus: "VALID" | "REVIEW";
};
export type MgbiFinancialResult = {
  section: SectionEnvelope<FinancialData>;
  facts: FinancialSourceFact[];
  errorCode: string | null;
};

const MODEL = "pl-krs-rdf-record";
const SOURCE = { provider: "MGBI" as const, model: MODEL, recordId: null };
const MAX_RESULTS = 100;

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
    const from = date(document?.period_from_date);
    const to = date(document?.period_to_date);
    const recordId = string(field(record, "id"));
    if (!standardized || !from || !to || !recordId || from > to) continue;
    const scope = document?.type === "consolidated_financial_statement" ? "CONSOLIDATED" : "UNIT";
    const schema = string(field(record, "content", "schema", "name")) ?? "";
    const unitCode = /wtysiacachzlotych/i.test(schema) ? "THOUSAND_PLN" : /wzlotych/i.test(schema) ? "PLN" : "UNKNOWN";
    const validationStatus = unitCode === "PLN" ? "VALID" : "REVIEW";
    const byPeriod = new Map<string, FinancialPeriod>();
    for (const [sectionName, sectionFields] of Object.entries(standardized)) {
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
          amount: numeric, currencyCode: "PLN", unitCode,
          sourcePath: `content.standardized_fields.${sectionName}.${sourceKey}`,
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
  if (!facts.length) return empty("EMPTY", retrievedAt, "MGBI_NO_STRUCTURED_FINANCIAL_DATA", null);
  const incomplete = totalCount > records.length;
  return {
    section: {
      status: incomplete ? "PARTIAL" : "SUCCESS",
      source: { ...SOURCE, recordId: string(field(selected[0], "id")) },
      retrievedAt,
      effectiveAt: date(field(selected[0], "document", "period_to_date")),
      data: { periods },
      warnings: incomplete ? ["MGBI_SEARCH_RESULT_LIMIT"] : [],
    },
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
    if (!results.length) return empty("EMPTY", retrievedAt, "MGBI_NO_STRUCTURED_FINANCIAL_DATA", null);
    return mapMgbiFinancialRecords(results, identifier, retrievedAt, typeof obj(body)?.count === "number" ? obj(body)!.count as number : results.length);
  } catch (error) {
    const timeout = controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
    return empty("ERROR", now().toISOString(), timeout ? "MGBI_TIMEOUT" : "MGBI_NETWORK_ERROR", timeout ? "TIMEOUT" : "NETWORK_ERROR");
  } finally { clearTimeout(timer); }
}
