import type { FinancialData, SectionEnvelope } from "@profitia/srm-xray";
import type { CompanyIdentifier } from "./mgbi-general";

const MODEL = "pl-krs-rdf-record";
const SOURCE = { provider: "MGBI" as const, model: MODEL, recordId: null };
type JsonObject = Record<string, unknown>;
export type FinancialDocument = {
  recordId: string;
  documentId: string;
  type: string;
  from: string | null;
  to: string | null;
  filingDate: string | null;
  isCorrection: boolean;
  isIasCompliant: boolean;
  scope: "standalone" | "consolidated" | "unknown";
};
export type FinancialCandidate = {
  documentId: string;
  metricCode: string;
  amount: string;
  comparison: "current" | "prior";
  sourcePath: string;
};
export type MgbiFinancialResult = {
  section: SectionEnvelope<FinancialData>;
  documents: FinancialDocument[];
  candidates: FinancialCandidate[];
  errorCode: string | null;
};
export type MgbiFinancialOptions = {
  apiKey?: string;
  authScheme?: "raw" | "bearer";
  baseUrl?: string;
  fetcher?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
};
const object = (value: unknown): JsonObject | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
const str = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const date = (value: unknown): string | null => {
  const text = str(value);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text)) ? text : null;
};
const amount = (value: unknown): string | null => {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s/g, "").replace(",", ".");
  return /^[+-]?\d+(?:\.\d+)?$/.test(text) ? text : null;
};
function scope(type: string): FinancialDocument["scope"] {
  if (/consolidated|skonsolidowan/i.test(type)) return "consolidated";
  if (/financial_statement|sprawozdanie_finansowe/i.test(type)) return "standalone";
  return "unknown";
}
function collectCandidates(fields: JsonObject | null, documentId: string): FinancialCandidate[] {
  if (!fields) return [];
  const facts: FinancialCandidate[] = [];
  for (const [group, values] of Object.entries(fields)) {
    const metrics = object(values);
    if (!metrics || !/^[a-z][a-z0-9_]*$/i.test(group)) continue;
    for (const [key, raw] of Object.entries(metrics)) {
      const match = /^([a-z][a-z0-9_]*)_(cfy|pfy)$/i.exec(key);
      const numeric = amount(raw);
      if (!match || numeric === null) continue;
      facts.push({ documentId, metricCode: group + "." + match[1], amount: numeric,
        comparison: match[2].toLowerCase() === "cfy" ? "current" : "prior",
        sourcePath: "content.standardized_fields." + group + "." + key });
    }
  }
  return facts;
}
function empty(status: "EMPTY" | "ERROR", retrievedAt: string, warning: string, errorCode: string | null): MgbiFinancialResult {
  return { section: { status, source: SOURCE, retrievedAt, effectiveAt: null, data: null, warnings: [warning] }, documents: [], candidates: [], errorCode };
}
export function mapMgbiFinancialRecords(body: unknown, identifier: CompanyIdentifier, retrievedAt: string): MgbiFinancialResult {
  const results = object(body)?.results;
  if (!Array.isArray(results)) return empty("ERROR", retrievedAt, "MGBI_INVALID_RESPONSE", "INVALID_RESPONSE");
  if (!results.length) return empty("EMPTY", retrievedAt, "MGBI_NO_FINANCIAL_DOCUMENT", null);
  const key = identifier.type === "NIP" ? "pl_nip" : "pl_krs";
  const matches = results.filter((item) => str(object(object(item)?.identifiers)?.[key]) === identifier.value);
  if (!matches.length) return empty("ERROR", retrievedAt, "MGBI_IDENTIFIER_MISMATCH", "IDENTIFIER_MISMATCH");
  const documents: FinancialDocument[] = [];
  const candidates: FinancialCandidate[] = [];
  const periods: Array<FinancialData["periods"][number]> = [];
  const warnings: string[] = [];
  for (const item of matches) {
    const record = object(item);
    const source = object(record?.document);
    const recordId = str(record?.id);
    if (!source || !recordId) continue;
    const documentId = String(source.document_id ?? recordId);
    const type = str(source.type) ?? "unknown";
    if (!/financial_statement|sprawozdanie_finansowe/i.test(type)) continue;
    const from = date(source.period_from_date);
    const to = date(source.period_to_date);
    documents.push({ recordId, documentId, type, from, to,
      filingDate: date(source.filing_date), isCorrection: source.is_correction === true,
      isIasCompliant: source.is_ias_compliant === true, scope: scope(type) });
    const content = object(record?.content);
    const documentCandidates = collectCandidates(object(content?.standardized_fields), documentId);
    candidates.push(...documentCandidates);
    const schemaName = str(object(content?.schema)?.name);
    const currentFacts = documentCandidates.filter((fact) => fact.comparison === "current");
    if (from && to && scope(type) !== "unknown" && schemaName?.endsWith("WZlotych") && currentFacts.length) {
      periods.push({ from, to, scope: scope(type) as "standalone" | "consolidated", documentId,
        facts: currentFacts.map(({ metricCode, amount }) => ({ metricCode, amount, currency: "PLN", unit: "PLN" })) });
    } else {
      warnings.push(documentCandidates.length ? "MGBI_FINANCIAL_SCHEMA_OR_PERIOD_UNVERIFIED" : "MGBI_FINANCIAL_CONTENT_UNAVAILABLE");
    }
  }
  if (!documents.length) return empty("EMPTY", retrievedAt, "MGBI_NO_FINANCIAL_DOCUMENT", null);
  return { section: { status: periods.length && !warnings.length ? "SUCCESS" : "PARTIAL",
    source: { ...SOURCE, recordId: documents[0].recordId }, retrievedAt,
    effectiveAt: documents[0].to, data: { periods }, warnings: [...new Set(warnings)] },
    documents, candidates, errorCode: null };
}
export async function fetchMgbiFinancial(identifier: CompanyIdentifier, options: MgbiFinancialOptions = {}): Promise<MgbiFinancialResult> {
  if (!/^[0-9]{10}$/.test(identifier.value) || (identifier.type !== "NIP" && identifier.type !== "KRS")) throw new Error("A valid ten-digit NIP or KRS is required");
  const apiKey = options.apiKey ?? process.env.MGBI_API_KEY;
  if (!apiKey?.trim()) throw new Error("MGBI_API_KEY is required");
  const scheme = options.authScheme ?? (process.env.MGBI_AUTH_SCHEME === "bearer" ? "bearer" : "raw");
  const baseUrl = options.baseUrl ?? "https://api.mgbi.pl";
  const listUrl = new URL("/v1/models/" + MODEL + "/records", baseUrl);
  listUrl.searchParams.set("identifiers." + (identifier.type === "NIP" ? "pl_nip" : "pl_krs"), identifier.value);
  listUrl.searchParams.set("document.type", "financial_statement");
  listUrl.searchParams.set("per_page", "20");
  const contentFields = ["identifiers", "document", "content.schema", "content.standardized_fields"];
  for (const field of contentFields) listUrl.searchParams.append("content", field);
  const now = options.now ?? (() => new Date());
  const headers = { Accept: "application/json", Authorization: scheme === "bearer" ? "Bearer " + apiKey.trim() : apiKey.trim() };
  async function request(url: URL): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
    try { return await (options.fetcher ?? fetch)(url, { method: "GET", cache: "no-store", signal: controller.signal, headers }); }
    finally { clearTimeout(timer); }
  }
  try {
    const response = await request(listUrl);
    const retrievedAt = now().toISOString();
    if (!response.ok) return empty("ERROR", retrievedAt, "MGBI_HTTP_" + response.status, "HTTP_" + response.status);
    let body: unknown;
    try { body = await response.json(); } catch { return empty("ERROR", retrievedAt, "MGBI_INVALID_JSON", "INVALID_JSON"); }
    const listed = object(body)?.results;
    if (!Array.isArray(listed)) return empty("ERROR", retrievedAt, "MGBI_INVALID_RESPONSE", "INVALID_RESPONSE");
    const records: unknown[] = [];
    const warnings: string[] = [];
    const identityKey = identifier.type === "NIP" ? "pl_nip" : "pl_krs";
    let rateLimited = false;
    for (const listedRecord of listed) {
      const item = object(listedRecord);
      const recordId = str(item?.id);
      if (!item || !recordId || str(object(item.identifiers)?.[identityKey]) !== identifier.value) {
        records.push(listedRecord);
        continue;
      }
      if (!/financial_statement|sprawozdanie_finansowe/i.test(str(object(item.document)?.type) ?? "")) {
        records.push(listedRecord);
        continue;
      }
      if (object(object(item.content)?.standardized_fields)) {
        records.push(listedRecord);
        continue;
      }
      if (rateLimited) { records.push(listedRecord); continue; }
      const detailUrl = new URL("/v1/models/" + MODEL + "/records/" + encodeURIComponent(recordId), baseUrl);
      for (const field of contentFields) detailUrl.searchParams.append("content", field);
      try {
        const detailResponse = await request(detailUrl);
        if (!detailResponse.ok) {
          warnings.push("MGBI_DETAIL_HTTP_" + detailResponse.status);
          if (detailResponse.status === 429) rateLimited = true;
          records.push(listedRecord);
          continue;
        }
        let detail: unknown;
        try { detail = await detailResponse.json(); }
        catch { warnings.push("MGBI_DETAIL_INVALID_JSON"); records.push(listedRecord); continue; }
        const exact = object(detail);
        if (str(exact?.id) !== recordId || str(object(exact?.identifiers)?.[identityKey]) !== identifier.value) {
          warnings.push("MGBI_DETAIL_IDENTIFIER_MISMATCH");
          records.push(listedRecord);
          continue;
        }
        records.push(detail);
      } catch (error) {
        warnings.push(error instanceof Error && error.name === "AbortError" ? "MGBI_DETAIL_TIMEOUT" : "MGBI_DETAIL_NETWORK_ERROR");
        records.push(listedRecord);
      }
    }
    const mapped = mapMgbiFinancialRecords({ results: records }, identifier, retrievedAt);
    if (Number(object(body)?.pages ?? 1) > 1) warnings.push("MGBI_ADDITIONAL_PAGES_NOT_FETCHED");
    if (!warnings.length) return mapped;
    return { ...mapped, section: { ...mapped.section,
      status: mapped.section.status === "SUCCESS" ? "PARTIAL" : mapped.section.status,
      warnings: [...new Set([...mapped.section.warnings, ...warnings])] } };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return empty("ERROR", now().toISOString(), timedOut ? "MGBI_TIMEOUT" : "MGBI_NETWORK_ERROR", timedOut ? "TIMEOUT" : "NETWORK_ERROR");
  }
}
