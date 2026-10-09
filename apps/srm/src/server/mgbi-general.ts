import type { GeneralCompanyData, SectionEnvelope } from "@profitia/srm-xray";
import { fetchMgbiPages } from "./mgbi-archive";

export type CompanyIdentifier = { type: "NIP" | "KRS"; value: string };
export type MgbiGeneralResult = {
  section: SectionEnvelope<GeneralCompanyData>;
  rawRecord: unknown | null;
  rawResponse?: { pages: unknown[]; recordCount: number };
  errorCode: string | null;
};
export type MgbiGeneralOptions = {
  apiKey?: string;
  authScheme?: "raw" | "bearer";
  baseUrl?: string;
  fetcher?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
};

const MODEL = "pl-krs-wp-record";
const SOURCE = { provider: "MGBI" as const, model: MODEL, recordId: null };
const FIELD_NAMES = ["legalName", "legalForm", "krs", "nip", "regon", "registeredAddress", "registeredAt", "mainPkd"] as const;

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function at(value: unknown, ...path: string[]): unknown {
  return path.reduce<unknown>((current, key) => object(current)?.[key], value);
}
function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}
function address(value: unknown): string | null {
  const parts = ["ulica", "nrDomu", "nrLokalu", "kodPocztowy", "miejscowosc", "kraj"]
    .map((key) => str(object(value)?.[key])).filter((part): part is string => part !== null);
  return parts.length ? parts.join(", ") : null;
}
function pkd(value: unknown): string | null {
  const entry = object(first(value));
  if (!entry) return null;
  const code = ["kodDzial", "kodKlasa", "kodPodklasa"]
    .map((key) => str(entry[key])).filter((part): part is string => part !== null).join(".");
  return str(entry.kod) ?? (code || null);
}
function empty(status: "EMPTY" | "ERROR", retrievedAt: string | null, warning: string, errorCode: string | null): MgbiGeneralResult {
  return { section: { status, source: SOURCE, retrievedAt, effectiveAt: null, data: null, warnings: [warning] }, rawRecord: null, errorCode };
}

export function mapMgbiGeneralRecord(record: unknown, retrievedAt: string): MgbiGeneralResult {
  const sourceRecord = object(record);
  if (!sourceRecord) return empty("ERROR", retrievedAt, "MGBI_INVALID_RECORD", "INVALID_RECORD");
  const identifiers = object(sourceRecord.identifiers);
  const excerpt = at(sourceRecord, "content", "current_excerpt");
  const header = at(excerpt, "naglowekA");
  const subject = at(excerpt, "dane", "dzial1", "danePodmiotu");
  const rawAddress = at(excerpt, "dane", "dzial1", "siedzibaIAdres", "adres");
  const activity = at(excerpt, "dane", "dzial3", "przedmiotDzialalnosci", "przedmiotPrzewazajacejDzialalnosci");
  const data: GeneralCompanyData = {
    legalName: str(at(subject, "nazwa")) ?? str(at(header, "nazwa")),
    legalForm: str(at(subject, "formaPrawna")),
    krs: str(identifiers?.pl_krs) ?? str(at(header, "numerKRS")),
    nip: str(identifiers?.pl_nip),
    regon: str(identifiers?.pl_regon),
    registeredAddress: address(rawAddress),
    registeredAt: str(at(header, "dataRejestracjiWKRS")),
    mainPkd: pkd(activity),
  };
  const missing = FIELD_NAMES.filter((field) => data[field] === null);
  const hasData = missing.length < FIELD_NAMES.length;
  const status = !hasData ? "EMPTY" : missing.length ? "PARTIAL" : "SUCCESS";
  return {
    section: {
      status,
      source: { ...SOURCE, recordId: str(sourceRecord.id) },
      retrievedAt,
      effectiveAt: str(at(header, "stanZDnia")) ?? str(at(header, "dataCzasOdpisu")),
      data: hasData ? data : null,
      warnings: missing.map((field) => `MGBI_MISSING_${field}`),
    },
    rawRecord: sourceRecord,
    errorCode: null,
  };
}

export async function fetchMgbiGeneral(identifier: CompanyIdentifier, options: MgbiGeneralOptions = {}): Promise<MgbiGeneralResult> {
  if (!/^[0-9]{10}$/.test(identifier.value) || (identifier.type !== "NIP" && identifier.type !== "KRS")) {
    throw new Error("A valid ten-digit NIP or KRS is required");
  }
  const apiKey = options.apiKey ?? process.env.MGBI_API_KEY;
  if (!apiKey?.trim()) throw new Error("MGBI_API_KEY is required");
  const scheme = options.authScheme ?? (process.env.MGBI_AUTH_SCHEME === "bearer" ? "bearer" : "raw");
  const baseUrl = options.baseUrl ?? "https://api.mgbi.pl";
  const url = new URL(`/v1/models/${MODEL}/records`, baseUrl);
  url.searchParams.set(identifier.type === "NIP" ? "identifiers.pl_nip" : "identifiers.pl_krs", identifier.value);
  const timeoutMs = options.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const now = options.now ?? (() => new Date());
  let mapping = false;
  try {
    const response = await fetchMgbiPages(url,
      { Accept: "application/json", Authorization: scheme === "bearer" ? `Bearer ${apiKey.trim()}` : apiKey.trim() },
      controller.signal, options.fetcher);
    const retrievedAt = now().toISOString();
    if (response.errorCode) return empty("ERROR", retrievedAt, `MGBI_${response.errorCode}`, response.errorCode);
    const results = response.records;
    if (results.length === 0) return { ...empty("EMPTY", retrievedAt, "MGBI_NO_RECORD", null),
      rawResponse: { pages: response.pages, recordCount: response.count } };
    const key = identifier.type === "NIP" ? "pl_nip" : "pl_krs";
    const record = results.find((candidate) => str(at(candidate, "identifiers", key)) === identifier.value);
    if (!record) return empty("ERROR", retrievedAt, "MGBI_IDENTIFIER_MISMATCH", "IDENTIFIER_MISMATCH");
    mapping = true;
    return { ...mapMgbiGeneralRecord(record, retrievedAt),
      rawResponse: { pages: response.pages, recordCount: response.count } };
  } catch (error) {
    const timedOut = controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
    const code = timedOut ? "TIMEOUT" : mapping ? "MAPPING_ERROR" : "NETWORK_ERROR";
    return empty("ERROR", now().toISOString(), `MGBI_${code}`, code);
  } finally { clearTimeout(timer); }
}
