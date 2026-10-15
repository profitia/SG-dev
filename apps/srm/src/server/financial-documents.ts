import { createHash } from "node:crypto";
import type { FinancialData, SectionEnvelope } from "@profitia/srm-xray";
import { withOrganization } from "./db";
import type { PoolClient } from "pg";

export const FINANCIAL_DOCUMENT_MAPPING_VERSION = "2026-10-10-xml-financial-v3";
export type AccountingStandard = "POLISH_UOR" | "IAS_IFRS" | "UNKNOWN";
export type FinancialAvailability = "XML_SUPPORTED" | "IXBRL_SUPPORTED" | "XHTML_SUPPORTED" | "NO_XML" | "UNKNOWN_FORMAT" | "UNSUPPORTED_XML";
export type FinancialSourceRow = { section: "Bilans" | "RZiS"; sourcePath: string; label: string; depth: number;
  amounts: Record<string, string | null>; canonicalMetricCode?: string };
export type FinancialSourceDocument = {
  recordId: string; documentId: string | null; scope: "standalone" | "consolidated"; from: string | null; to: string | null;
  standard: AccountingStandard; isIasCompliant: boolean | null; standardBasis: string;
  provider: "MGBI"; model: "pl-krs-rdf-record"; format: "XML" | "XHTML" | "PDF" | "UNKNOWN";
  availability: FinancialAvailability; formatBasis: string; schemaName: string | null; schemaVersion: string | null; schemaVariant?: string | null; schemaSystemCode?: string | null;
  currency: string | null; scale: string | null; correction: boolean | null; filingDate: string | null;
  checksum: string; mappingVersion: string; validation: "VALID" | "REVIEW";
  columns: { sourceColumn: string; role: "CURRENT" | "COMPARATIVE" | "UNKNOWN"; from: string | null; to: string | null; basis: string }[];
  /** Verified primary metric observations; immutable original checksum binds their provenance. */
  metricEvidence?: { code: string; from: string; to: string; value: string; currency: string;
    concept: string; contextRef: string; factId: string; semanticBasis: string }[];
  rows: FinancialSourceRow[];
};
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const date = (value: unknown): string | null => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
const knownSchema = (name: string, version: string) => /^(Skonsolidowana)?Jednostka(Inna|Mala|Mikro)(WZlotych|WTysiacachZlotych)$/i.test(name) && /^1-[0123]E?$/.test(version);

/** MGBI's XML dictionary is authoritative for full sections; standardized fields are a derived subset.
 * Keep one source path per position, including custom rows. No amount/name-based merging is allowed.
 * The adapter consumes structured XML fields only and never downloads or follows document URLs.
 */
export function projectFinancialDocuments(records: unknown[]): FinancialSourceDocument[] {
  if (records.length > 10_000) throw new Error("Financial document limit exceeded");
  return records.flatMap((raw) => {
    const record = object(raw), document = object(record.document), content = object(record.content), schema = object(content.schema);
    if (!["financial_statement", "consolidated_financial_statement"].includes(String(document.type)) || !text(record.id)) return [];
    const extracted = object(content.extracted_fields);
    if (Object.keys(extracted).length > 50_000) throw new Error("Financial XML complexity limit exceeded");
    const normalized = new Map(Object.entries(extracted).map(([path, value]) => [path.replaceAll(">", "."), value]));
    const schemaName = text(schema.name), schemaVersion = text(schema.version);
    const recognized = knownSchema(schemaName ?? "", schemaVersion ?? "");
    const original = object(object(object(record.files).main_document).original);
    const mime = text(original.content_type)?.split(";")[0].toLowerCase();
    const pdf = mime === "application/pdf";
    const explicitXml = mime === "application/xml" || mime === "text/xml" || Boolean(mime?.endsWith("+xml"));
    const hasXmlFields = Object.keys(extracted).some((path) => /^(Bilans|RZiS)[.>]/.test(path));
    const format = pdf ? "PDF" : explicitXml || (recognized && hasXmlFields) ? "XML" : "UNKNOWN";
    const availability: FinancialAvailability = pdf ? "NO_XML" : format === "UNKNOWN" ? "UNKNOWN_FORMAT" : !recognized || !hasXmlFields ? "UNSUPPORTED_XML" : "XML_SUPPORTED";
    const from = date(normalized.get("Naglowek.OkresOd")) ?? date(document.period_from_date);
    const to = date(normalized.get("Naglowek.OkresDo")) ?? date(document.period_to_date);
    const rows = new Map<string, FinancialSourceRow>();
    const sourceColumns = new Set<string>();
    if (availability === "XML_SUPPORTED") for (const [originalPath, value] of Object.entries(extracted)) {
      const path = originalPath.replaceAll(">", ".");
      const match = /^(Bilans|RZiS)\.(.+)\.(Kwota[A-Z]\d*)$/.exec(path);
      if (!match) continue;
      if (path.length > 2000 || path.split(".").length > 32) throw new Error("Financial XML path limit exceeded");
      const rowPath = path.slice(0, -(match[3].length + 1));
      let row = rows.get(rowPath);
      if (!row) {
        const labelPath = rowPath.replace(/\.KwotyPozycji$/, "");
        row = { section: match[1] as "Bilans" | "RZiS", sourcePath: originalPath.slice(0, -(match[3].length + 1)),
          label: text(normalized.get(labelPath + ".NazwaPozycji")) ?? text(normalized.get(labelPath + ".Nazwa")) ?? rowPath,
          depth: labelPath.split(".").length - 1, amounts: {} };
        rows.set(rowPath, row);
      }
      const amount = value === null || value === undefined || value === "" ? null : typeof value === "number" && Number.isFinite(value) ? String(value) : text(value);
      if ((value !== null && value !== undefined && value !== "" && amount === null) || (amount !== null && (amount.length > 256 || !/^-?\d+(?:\.\d+)?$/.test(amount)))) throw new Error("Invalid financial XML amount");
      row.amounts[match[3]] = amount; sourceColumns.add(match[3]);
    }
    const xmlCurrency = text(normalized.get("Naglowek.Waluta"));
    const currency = xmlCurrency && /^[A-Z]{3}$/.test(xmlCurrency) ? xmlCurrency : recognized ? "PLN" : null;
    const scale = recognized && /WTysiacachZlotych$/i.test(schemaName!) ? "1000" : recognized && /WZlotych$/i.test(schemaName!) ? "1" : null;
    const isIasCompliant = typeof document.is_ias_compliant === "boolean" ? document.is_ias_compliant : null;
    // A provider flag cannot override an explicit contradictory XML accounting declaration.
    // Inspect only the accounting-basis field; its text never enters the financial projection.
    const basisText = (text(normalized.get("WprowadzenieDoSprawozdaniaFinansowego.P_7.P_7D")) ?? "")
      .slice(0, 2000).normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").toLowerCase();
    const declaresPolishUor = /sprawozdanie finansowe.{0,80}sporzadzon.{0,350}ustaw.{0,30}o rachunkowosci/.test(basisText)
      && !/(mssf|\bmsr\b|ifrs|international financial reporting)/.test(basisText);
    const standardConflict = isIasCompliant === true && declaresPolishUor;
    const standard: AccountingStandard = standardConflict ? "UNKNOWN" : isIasCompliant === true ? "IAS_IFRS" : isIasCompliant === false && recognized ? "POLISH_UOR" : "UNKNOWN";
    // KwotaB1 is a separate source column. Its dates cannot be inferred from the current year.
    const columns = [...sourceColumns].sort().map((sourceColumn) => ({ sourceColumn,
      role: sourceColumn === "KwotaA" ? "CURRENT" as const : sourceColumn === "KwotaB" ? "COMPARATIVE" as const : "UNKNOWN" as const,
      from: sourceColumn === "KwotaA" ? from : null, to: sourceColumn === "KwotaA" ? to : null,
      basis: sourceColumn === "KwotaA" ? "XML_HEADER" : "SOURCE_COLUMN_DATES_UNRESOLVED" }));
    return [{ recordId: String(record.id), documentId: typeof document.document_id === "number" || typeof document.document_id === "string" ? String(document.document_id) : null,
      scope: document.type === "consolidated_financial_statement" ? "consolidated" as const : "standalone" as const,
      from, to, standard, isIasCompliant, standardBasis: standardConflict ? "MGBI_IAS_FLAG_CONFLICTS_WITH_XML_UOR_DECLARATION" : isIasCompliant === true ? "MGBI_DOCUMENT_IAS_FLAG" : standard === "POLISH_UOR" ? "MGBI_DOCUMENT_FLAG_AND_POLISH_XML_SCHEMA" : "UNDETERMINED",
      provider: "MGBI" as const, model: "pl-krs-rdf-record" as const, format, availability, formatBasis: mime ? "MGBI_ORIGINAL_CONTENT_TYPE" : hasXmlFields && recognized ? "MGBI_XML_DICTIONARY_AND_SCHEMA" : "UNDETERMINED",
      schemaName, schemaVersion, schemaVariant: text(normalized.get("Naglowek.WariantSprawozdania")),
      schemaSystemCode: text(normalized.get("Naglowek.KodSprawozdania.@kodSystemowy")), currency, scale, correction: typeof document.is_correction === "boolean" ? document.is_correction : null, filingDate: date(document.filing_date),
      checksum: createHash("sha256").update(JSON.stringify(raw)).digest("hex"), mappingVersion: FINANCIAL_DOCUMENT_MAPPING_VERSION,
      validation: availability === "XML_SUPPORTED" && from && to && from <= to && currency && scale && rows.size ? "VALID" as const : "REVIEW" as const,
      columns, rows: [...rows.values()].sort((a,b) => a.sourcePath.replaceAll(">", ".").localeCompare(b.sourcePath.replaceAll(">", "."), "pl", { numeric: true })) }];
  });
}
export function financialRecordsFromPages(pages: unknown[]): unknown[] { return pages.flatMap((page) => Array.isArray(object(page).results) ? object(page).results as unknown[] : []); }

type DocumentClient = Pick<PoolClient, "query">;
export type FinancialArchive = { organization_id: string; nip: string; model: string;
  payload_text: string; payload_jsonb_sha256: string; record_count: number };
const checksum = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const hashFormat = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);

/** Verify exact persisted JSONB bytes before parsing. Never hash a reserialized object
 * against the historical wire hash, follow URLs, or obtain another tenant's source. */
export function projectArchivedFinancialDocuments(archive: FinancialArchive, organizationId: string, nip: string): FinancialSourceDocument[] {
  if (archive.organization_id !== organizationId || archive.nip !== nip || archive.model !== "pl-krs-rdf-record")
    throw new Error("Financial archive identity mismatch");
  if (!hashFormat(archive.payload_jsonb_sha256) || typeof archive.payload_text !== "string" || archive.payload_text.length > 20_000_000
      || checksum(archive.payload_text) !== archive.payload_jsonb_sha256) throw new Error("Financial archive checksum mismatch");
  const payload = object(JSON.parse(archive.payload_text));
  if (!Array.isArray(payload.pages) || payload.pages.length === 0 || payload.pages.length > 100
      || payload.pages.some(page => !Array.isArray(object(page).results))) throw new Error("Incomplete financial archive");
  const records = financialRecordsFromPages(payload.pages);
  if (!Number.isSafeInteger(archive.record_count) || archive.record_count < 0 || records.length !== archive.record_count || records.length > 10_000)
    throw new Error("Financial archive record count mismatch");
  if (records.some(record => object(object(record).identifiers).pl_nip !== nip)) throw new Error("Financial archive supplier mismatch");
  const documents = projectFinancialDocuments(records);
  if (new Set(documents.map(d => d.recordId)).size !== documents.length) throw new Error("Duplicate financial archive document");
  return documents;
}

export async function saveFinancialDocuments(organizationId: string, nip: string, pages: unknown[]): Promise<{ documents: number; positions: number }> {
  const documents = projectFinancialDocuments(financialRecordsFromPages(pages));
  return withOrganization(organizationId, client => persistFinancialDocuments(client, organizationId, nip, documents));
}

export async function persistFinancialDocuments(client: DocumentClient, organizationId: string, nip: string,
  documents: readonly FinancialSourceDocument[], archiveChecksum: string | null = null,
  verifiedProjection?: { version:string; checksum:string }): Promise<{ documents: number; positions: number }> {
    for (const document of documents) await client.query(
      `INSERT INTO srm.financial_source_documents(organization_id,nip,record_id,document_json,checksum_sha256,mapping_version,archive_jsonb_sha256)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7) ON CONFLICT (organization_id,nip,record_id) DO UPDATE SET
       document_json=EXCLUDED.document_json,checksum_sha256=EXCLUDED.checksum_sha256,mapping_version=EXCLUDED.mapping_version,updated_at=now()
       ,archive_jsonb_sha256=CASE WHEN EXCLUDED.archive_jsonb_sha256 IS NOT NULL OR
         (srm.financial_source_documents.checksum_sha256,srm.financial_source_documents.mapping_version) IS DISTINCT FROM (EXCLUDED.checksum_sha256,EXCLUDED.mapping_version)
         THEN EXCLUDED.archive_jsonb_sha256 ELSE srm.financial_source_documents.archive_jsonb_sha256 END
       WHERE ((srm.financial_source_documents.checksum_sha256,srm.financial_source_documents.mapping_version) IS DISTINCT FROM (EXCLUDED.checksum_sha256,EXCLUDED.mapping_version)
         OR (EXCLUDED.archive_jsonb_sha256 IS NOT NULL AND srm.financial_source_documents.archive_jsonb_sha256 IS DISTINCT FROM EXCLUDED.archive_jsonb_sha256))
       AND (EXCLUDED.document_json->>'availability' IN ('XML_SUPPORTED','IXBRL_SUPPORTED','XHTML_SUPPORTED') OR srm.financial_source_documents.document_json->>'availability' NOT IN ('XML_SUPPORTED','IXBRL_SUPPORTED','XHTML_SUPPORTED'))
       AND (EXCLUDED.document_json->>'validation' = 'VALID' OR srm.financial_source_documents.document_json->>'validation' <> 'VALID'
         OR $8::boolean)`,
      [organizationId,nip,document.recordId,JSON.stringify(document),document.checksum,document.mappingVersion,archiveChecksum,
        verifiedProjection?.version===document.mappingVersion && verifiedProjection?.checksum===document.checksum]);
    return { documents: documents.length, positions: documents.reduce((count, document) => count + document.rows.length, 0) };
}

type StoredDocument = { organization_id: string; nip: string; record_id: string; document_json: FinancialSourceDocument;
  checksum_sha256: string; mapping_version: string; archive_jsonb_sha256: string | null; document_text: string; document_jsonb_sha256: string };
async function storedDocuments(client: DocumentClient, organizationId: string, nip: string): Promise<StoredDocument[]> {
  const rows = (await client.query<StoredDocument>(
    "SELECT organization_id,nip,record_id,document_json,checksum_sha256,mapping_version,archive_jsonb_sha256,document_json::text AS document_text,document_jsonb_sha256 FROM srm.financial_source_documents WHERE organization_id=$1 AND nip=$2 ORDER BY record_id", [organizationId,nip])).rows;
  if (rows.some(r => r.organization_id !== organizationId || r.nip !== nip || r.record_id !== r.document_json?.recordId
      || !hashFormat(r.checksum_sha256) || r.checksum_sha256 !== r.document_json?.checksum || r.mapping_version !== r.document_json?.mappingVersion
      || !hashFormat(r.document_jsonb_sha256) || typeof r.document_text !== "string" || checksum(r.document_text) !== r.document_jsonb_sha256))
    throw new Error("Financial document identity or checksum mismatch");
  return rows;
}

/** Caller owns the withOrganization transaction. A shared archive lock fences provider
 * replacement until all derived rows commit; concurrent restores use the same upsert. */
export async function restoreFinancialDocumentsFromArchive(client: DocumentClient, organizationId: string, nip: string): Promise<FinancialSourceDocument[]> {
  const archive = (await client.query<FinancialArchive & { observed_checksum: string; financial_record_ids: string[]; observed_record_count: number; mismatched_supplier_count: number; page_count: number }>(
    `SELECT organization_id,nip,model,payload_jsonb_sha256,record_count,
       encode(sha256(convert_to(payload_json::text,'UTF8')),'hex') AS observed_checksum,
       jsonb_array_length(payload_json->'pages') AS page_count,
       (SELECT count(*)::int FROM jsonb_array_elements(payload_json->'pages') page CROSS JOIN LATERAL jsonb_array_elements(page->'results') r) AS observed_record_count,
       (SELECT count(*)::int FROM jsonb_array_elements(payload_json->'pages') page CROSS JOIN LATERAL jsonb_array_elements(page->'results') r WHERE r#>>'{identifiers,pl_nip}' IS DISTINCT FROM nip) AS mismatched_supplier_count,
       ARRAY(SELECT r->>'id' FROM jsonb_array_elements(payload_json->'pages') page
         CROSS JOIN LATERAL jsonb_array_elements(page->'results') r
         WHERE r#>>'{document,type}' IN ('financial_statement','consolidated_financial_statement') AND r->>'id' IS NOT NULL) AS financial_record_ids
     FROM srm.mgbi_source_archives WHERE organization_id=$1 AND nip=$2 AND model='pl-krs-rdf-record' FOR SHARE`, [organizationId,nip])).rows[0];
  const stored = await storedDocuments(client,organizationId,nip);
  if (!archive) return stored.map(r => r.document_json);
  if (archive.organization_id !== organizationId || archive.nip !== nip || archive.model !== "pl-krs-rdf-record"
      || !hashFormat(archive.payload_jsonb_sha256) || archive.payload_jsonb_sha256 !== archive.observed_checksum)
    throw new Error("Financial archive identity or checksum mismatch");
  const ids = archive.financial_record_ids;
  if (!Number.isSafeInteger(archive.record_count) || archive.record_count < 0 || archive.record_count > 10_000
      || archive.record_count !== archive.observed_record_count || archive.mismatched_supplier_count !== 0
      || archive.page_count < 1 || archive.page_count > 100 || !Array.isArray(ids) || new Set(ids).size !== ids.length)
    throw new Error("Incomplete or ambiguous financial archive inventory");
  const expected = stored.filter(r => ids.includes(r.record_id));
  if (expected.length === ids.length && expected.every(r => r.archive_jsonb_sha256 === archive.payload_jsonb_sha256
      && (r.mapping_version === FINANCIAL_DOCUMENT_MAPPING_VERSION || ["IXBRL_SUPPORTED","XHTML_SUPPORTED"].includes(r.document_json.availability)))) return expected.map(r => r.document_json);
  const payload = (await client.query<{ payload_text: string }>(
    "SELECT payload_json::text AS payload_text FROM srm.mgbi_source_archives WHERE organization_id=$1 AND nip=$2 AND model='pl-krs-rdf-record'", [organizationId,nip])).rows[0];
  if (!payload) throw new Error("Financial archive changed during reconstruction");
  const documents = projectArchivedFinancialDocuments({...archive,...payload},organizationId,nip);
  await persistFinancialDocuments(client,organizationId,nip,documents,archive.payload_jsonb_sha256);
  // Return the actual rows, including any better-quality preserved projection.
  return (await storedDocuments(client,organizationId,nip)).filter(r => ids.includes(r.record_id)).map(r => r.document_json);
}

export async function readFinancialDocuments(organizationId: string, nip: string): Promise<FinancialSourceDocument[]> {
  return withOrganization(organizationId, client => restoreFinancialDocumentsFromArchive(client,organizationId,nip));
}

/** Enrich saved tenant reports without re-fetching, revaluing facts or expanding the shared catalog. */
export function applyFinancialDocumentMetadata(section: SectionEnvelope<FinancialData>, documents: readonly FinancialSourceDocument[]): SectionEnvelope<FinancialData> {
 if (!documents.length) return section;
 if (section.data) return { ...section, data: { ...section.data, periods: section.data.periods.map(period => {
  const document = documents.find(item => item.recordId === period.documentId.replace(/:(cfy|pfy)$/, "") && item.scope === period.scope);
  return document ? { ...period, accountingStandard: document.standard, accountingStandardBasis: document.standardBasis,
   isIasCompliant: document.isIasCompliant, xmlSchema: {name:document.schemaName,version:document.schemaVersion} } : period;
 }) } };
 if (section.status !== "EMPTY") return section;
 // IAS is an accounting-standard explanation; file-format warnings are secondary.
 // Supported or conflicting XML and mixed standards must never be classified as unsupported IAS.
 if (documents.every(document => document.standard === "IAS_IFRS" && document.availability !== "XML_SUPPORTED" && !document.rows.length)
     && !section.warnings.some(value => /TRUNCAT|PAGINAT|PARTIAL/.test(value)))
   return {...section,warnings:["MGBI_INTERNATIONAL_STATEMENT_WITHOUT_FACTS",...section.warnings.filter(value=>!["MGBI_INTERNATIONAL_STATEMENT_WITHOUT_FACTS","MGBI_NO_STRUCTURED_FINANCIAL_DATA"].includes(value))]};
 const availability = documents.map(document => document.availability);
 const warning = availability.every(value=>value === "NO_XML") ? "MGBI_FINANCIAL_NO_XML" : availability.includes("UNSUPPORTED_XML") ? "MGBI_FINANCIAL_UNSUPPORTED_XML" : availability.includes("UNKNOWN_FORMAT") ? "MGBI_FINANCIAL_UNKNOWN_FORMAT" : null;
 return warning ? {...section,warnings:[...section.warnings.filter(value=>!["MGBI_INTERNATIONAL_STATEMENT_WITHOUT_FACTS","MGBI_NO_STRUCTURED_FINANCIAL_DATA"].includes(value)),warning]} : section;
}
