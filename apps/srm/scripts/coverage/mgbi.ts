import { object, validNip } from "./bzp";

const ROOT = "https://api.mgbi.pl/v1/models/pl-krs-rdf-record";
// Positive selection: no originals, URLs, registry people, XML free text or attachments.
export const FIELDS = ["identifiers.pl_nip", "identifiers.pl_krs", "document.type", "document.filing_date",
  "document.period_from_date", "document.period_to_date", "document.is_correction", "document.is_ias_compliant",
  "content.schema", "content.standardized_fields", "files.main_document.original.content_type"] as const;
export const PROJECTION_VERSION = "rdf-metadata-standardized-v1";
export class AuditStop extends Error {}
export async function readJson(response: Response, maxBytes = 8_000_000): Promise<unknown> {
  if (!response.ok) throw new AuditStop(`HTTP_${response.status}`);
  if (!/application\/(?:[\w.+-]*\+)?json/i.test(response.headers.get("content-type") ?? "")) throw new AuditStop("NON_JSON_RESPONSE");
  if (!response.body) throw new AuditStop("EMPTY_RESPONSE");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) throw new AuditStop("RESPONSE_SIZE_LIMIT");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { await reader.cancel(); }
}
export function validateMgbiUrl(url: URL): void {
  if (url.origin !== "https://api.mgbi.pl" || ![`${new URL(ROOT).pathname}/records`, `${new URL(ROOT).pathname}/limits`].includes(url.pathname)
    || url.username || url.password || url.hash) throw new AuditStop("NO_FILES_NETWORK_POLICY");
  if (url.pathname.endsWith("/records")) {
    const keys = [...url.searchParams.keys()];
    const fields = url.searchParams.getAll("content");
    if (!validNip(url.searchParams.get("identifiers.pl_nip")) || fields.length !== FIELDS.length
      || fields.some((field, i) => field !== FIELDS[i]) || keys.some(key => !["identifiers.pl_nip", "content", "page", "per_page"].includes(key))) throw new AuditStop("MINIMAL_PROJECTION_REQUIRED");
  }
}
export class MetadataClient {
  constructor(private key: string, private scheme: string, private beforeRequest: (kind: "records" | "limits") => Promise<void>, private fetcher: typeof fetch = fetch) {
    if (!key.trim()) throw new AuditStop("MISSING_MGBI_API_KEY");
  }
  private async get(url: URL): Promise<unknown> {
    validateMgbiUrl(url);
    for (let attempt = 0; attempt < 2; attempt++) {
      await this.beforeRequest(url.pathname.endsWith("/records") ? "records" : "limits");
      const response = await this.fetcher(url, { method: "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30_000),
        headers: { Accept: "application/json", Authorization: this.scheme === "bearer" ? `Bearer ${this.key.trim()}` : this.key.trim() } });
      if ([502, 503, 504].includes(response.status) && attempt === 0) {
        await response.body?.cancel();
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      return readJson(response);
    }
    throw new AuditStop("RETRIES_EXHAUSTED");
  }
  async limits(): Promise<{ remainingSearch: number; filesUsed: number; maxSearch: number }> {
    const body = object(await this.get(new URL(`${ROOT}/limits`)));
    const max = object(body.max), used = object(body.used);
    for (const value of [max.api_search, used.api_search, used.files]) if (!Number.isSafeInteger(value) || Number(value) < 0) throw new AuditStop("INVALID_LIMITS");
    return { remainingSearch: Math.max(0, Number(max.api_search) - Number(used.api_search)), filesUsed: Number(used.files), maxSearch: Number(max.api_search) };
  }
  async page(nip: string, page: number): Promise<{ records: unknown[]; count: number; pages: number }> {
    const url = new URL(`${ROOT}/records`);
    url.searchParams.set("identifiers.pl_nip", nip);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    for (const field of FIELDS) url.searchParams.append("content", field);
    const body = object(await this.get(url));
    if (!Array.isArray(body.results) || !Number.isSafeInteger(body.count) || Number(body.count) < 0 || !Number.isSafeInteger(body.pages)
      || Number(body.pages) < 0 || Number(body.pages) > 100 || Number(body.count) > 10_000) throw new AuditStop("INVALID_PAGINATION");
    return { records: body.results.map(minimalRecord), count: Number(body.count), pages: Number(body.pages) };
  }
}

/** Defense in depth: even an ignored provider projection never persists arbitrary text/URLs. */
export function minimalRecord(raw: unknown): Record<string, unknown> {
  const record = object(raw), identifiers = object(record.identifiers), doc = object(record.document), content = object(record.content);
  const id = typeof record.id === "string" && /^[\w-]{1,100}$/.test(record.id) ? record.id : null;
  if (!id) throw new AuditStop("RECORD_ID_INVALID");
  const safeDoc: Record<string, unknown> = {};
  for (const key of ["type", "filing_date", "period_from_date", "period_to_date", "is_correction", "is_ias_compliant"]) {
    const value = doc[key];
    if (typeof value === "boolean" || value === null || typeof value === "string" && /^[\w-]{1,100}$/.test(value)) safeDoc[key] = value;
  }
  const safeFields: Record<string, unknown> = {};
  for (const [group, values] of Object.entries(object(content.standardized_fields))) {
    if (!/^[a-z]{1,12}$/.test(group)) continue;
    const entries = Object.entries(object(values));
    if (entries.length > 5000) throw new AuditStop("METRIC_COMPLEXITY_LIMIT");
    safeFields[group] = Object.fromEntries(entries.filter(([key, value]) => /^[a-z0-9_]{1,100}$/.test(key)
      && (value === null || typeof value === "number" && Number.isFinite(value) || typeof value === "string" && /^-?\d{1,30}(?:\.\d{1,10})?$/.test(value))));
  }
  const schema = object(content.schema);
  const safeSchema = Object.fromEntries(Object.entries(schema).filter(([key, value]) => ["name", "version"].includes(key) && typeof value === "string" && /^[\w-]{1,100}$/.test(value)));
  const mime = object(object(object(record.files).main_document).original).content_type;
  return { id, identifiers: { pl_nip: identifiers.pl_nip, pl_krs: typeof identifiers.pl_krs === "string" && /^\d{10}$/.test(identifiers.pl_krs) ? identifiers.pl_krs : null },
    document: safeDoc, content: { ...(Object.keys(safeSchema).length ? { schema: safeSchema } : {}), ...(Object.keys(safeFields).length ? { standardized_fields: safeFields } : {}) },
    files: { main_document: { original: { content_type: typeof mime === "string" && /^[\w.+-]+\/[\w.+-]+(?:;[\w= .-]+)?$/.test(mime) ? mime : null } } } };
}
