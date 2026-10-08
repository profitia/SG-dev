import { createHash } from "node:crypto";
import { withOrganization } from "./db";

const PAGE_SIZE = 100;
const MAX_PAGES = 100;
export type MgbiModel = "pl-krs-wp-record" | "pl-krs-rdf-record";
export type MgbiPages = { pages: unknown[]; records: unknown[]; count: number; errorCode: null }
  | { pages: []; records: []; count: 0; errorCode: string };

/** Fetch every page of a model search; an incomplete response is never archived as complete. */
export async function fetchMgbiPages(url: URL, headers: HeadersInit, signal: AbortSignal,
  fetcher: typeof fetch = fetch): Promise<MgbiPages> {
  const pages: unknown[] = [];
  const records: unknown[] = [];
  let count: number | null = null;
  let expectedPages: number | null = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const pageUrl = new URL(url);
    pageUrl.searchParams.set("per_page", String(PAGE_SIZE));
    pageUrl.searchParams.set("page", String(page));
    const response = await fetcher(pageUrl, { method: "GET", headers, signal, cache: "no-store" });
    if (!response.ok) return { pages: [], records: [], count: 0, errorCode: `HTTP_${response.status}` };
    let body: unknown;
    try { body = await response.json(); } catch { return { pages: [], records: [], count: 0, errorCode: "INVALID_JSON" }; }
    if (!body || typeof body !== "object" || Array.isArray(body)) return { pages: [], records: [], count: 0, errorCode: "INVALID_RESPONSE" };
    const value = body as Record<string, unknown>;
    if (!Array.isArray(value.results)) return { pages: [], records: [], count: 0, errorCode: "INVALID_RESPONSE" };
    if (page === 1) {
      if (typeof value.count === "number" && Number.isSafeInteger(value.count) && value.count >= 0) count = value.count;
      if (typeof value.pages === "number" && Number.isSafeInteger(value.pages) && value.pages >= 0) expectedPages = value.pages;
      if (expectedPages !== null && expectedPages > MAX_PAGES) return { pages: [], records: [], count: 0, errorCode: "RESULT_LIMIT" };
      if (count !== null && count > PAGE_SIZE * MAX_PAGES) return { pages: [], records: [], count: 0, errorCode: "RESULT_LIMIT" };
    }
    pages.push(body);
    records.push(...value.results);
    if (expectedPages !== null ? page >= expectedPages
      : count !== null ? records.length >= count : value.results.length < PAGE_SIZE) {
      if (count !== null && records.length < count) return { pages: [], records: [], count: 0, errorCode: "INCOMPLETE_RESPONSE" };
      return { pages, records, count: records.length, errorCode: null };
    }
    if (!value.results.length) return { pages: [], records: [], count: 0, errorCode: "INCOMPLETE_RESPONSE" };
  }
  return { pages: [], records: [], count: 0, errorCode: "RESULT_LIMIT" };
}

/** The complete API payload stays tenant-scoped; only mapped person-free facts enter the shared catalog. */
export async function saveMgbiArchive(organizationId: string, nip: string, model: MgbiModel,
  pages: unknown[], recordCount: number, retrievedAt: string, sourceRequestId: string): Promise<void> {
  if (!/^\d{10}$/.test(nip) || !pages.length || !Number.isSafeInteger(recordCount) || recordCount < 0) {
    throw new Error("A complete MGBI response and NIP are required for archiving");
  }
  const payload = JSON.stringify({ pages });
  const digest = createHash("sha256").update(payload).digest("hex");
  await withOrganization(organizationId, async (client) => {
    await client.query(
      `INSERT INTO srm.mgbi_source_archives(organization_id, nip, model, payload_json, payload_sha256,
         record_count, first_retrieved_at, last_checked_at, source_request_id)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $7, $8)
       ON CONFLICT (organization_id, nip, model) DO UPDATE SET
         payload_json = CASE WHEN srm.mgbi_source_archives.payload_sha256 IS DISTINCT FROM EXCLUDED.payload_sha256
           THEN EXCLUDED.payload_json ELSE srm.mgbi_source_archives.payload_json END,
         payload_sha256 = EXCLUDED.payload_sha256, record_count = EXCLUDED.record_count,
         last_checked_at = EXCLUDED.last_checked_at, source_request_id = EXCLUDED.source_request_id`,
      [organizationId, nip, model, payload, digest, recordCount, new Date(retrievedAt), sourceRequestId],
    );
  });
}
