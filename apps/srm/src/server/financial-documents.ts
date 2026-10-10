import { createHash } from "node:crypto";
import type { FinancialData, SectionEnvelope } from "@profitia/srm-xray";
import { withOrganization } from "./db";

export const FINANCIAL_DOCUMENT_MAPPING_VERSION = "2026-10-10-xml-financial-v3";
export type AccountingStandard = "POLISH_UOR" | "IAS_IFRS" | "UNKNOWN";
export type FinancialAvailability = "XML_SUPPORTED" | "NO_XML" | "UNKNOWN_FORMAT" | "UNSUPPORTED_XML";
export type FinancialSourceRow = { section: "Bilans" | "RZiS"; sourcePath: string; label: string; depth: number;
  amounts: Record<string, string | null>; canonicalMetricCode?: string };
export type FinancialSourceDocument = {
  recordId: string; documentId: string | null; scope: "standalone" | "consolidated"; from: string | null; to: string | null;
  standard: AccountingStandard; isIasCompliant: boolean | null; standardBasis: string;
  provider: "MGBI"; model: "pl-krs-rdf-record"; format: "XML" | "PDF" | "UNKNOWN";
  availability: FinancialAvailability; formatBasis: string; schemaName: string | null; schemaVersion: string | null; schemaVariant?: string | null; schemaSystemCode?: string | null;
  currency: string | null; scale: string | null; correction: boolean | null; filingDate: string | null;
  checksum: string; mappingVersion: string; validation: "VALID" | "REVIEW";
  columns: { sourceColumn: string; role: "CURRENT" | "COMPARATIVE" | "UNKNOWN"; from: string | null; to: string | null; basis: string }[];
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

export async function saveFinancialDocuments(organizationId: string, nip: string, pages: unknown[]): Promise<{ documents: number; positions: number }> {
  const documents = projectFinancialDocuments(financialRecordsFromPages(pages));
  return withOrganization(organizationId, async (client) => {
    for (const document of documents) await client.query(
      `INSERT INTO srm.financial_source_documents(organization_id,nip,record_id,document_json,checksum_sha256,mapping_version)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6) ON CONFLICT (organization_id,nip,record_id) DO UPDATE SET
       document_json=EXCLUDED.document_json,checksum_sha256=EXCLUDED.checksum_sha256,mapping_version=EXCLUDED.mapping_version,updated_at=now()
       WHERE (srm.financial_source_documents.checksum_sha256,srm.financial_source_documents.mapping_version) IS DISTINCT FROM (EXCLUDED.checksum_sha256,EXCLUDED.mapping_version)
       AND (EXCLUDED.document_json->>'availability' = 'XML_SUPPORTED' OR srm.financial_source_documents.document_json->>'availability' <> 'XML_SUPPORTED')
       AND (EXCLUDED.document_json->>'validation' = 'VALID' OR srm.financial_source_documents.document_json->>'validation' <> 'VALID')`,
      [organizationId,nip,document.recordId,JSON.stringify(document),document.checksum,document.mappingVersion]);
    return { documents: documents.length, positions: documents.reduce((count, document) => count + document.rows.length, 0) };
  });
}
export async function readFinancialDocuments(organizationId: string, nip: string): Promise<FinancialSourceDocument[]> {
  return withOrganization(organizationId, async (client) => (await client.query<{ document_json: FinancialSourceDocument }>(
    "SELECT document_json FROM srm.financial_source_documents WHERE organization_id=$1 AND nip=$2 ORDER BY record_id", [organizationId,nip])).rows.map((row) => row.document_json));
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
 const availability = documents.map(document => document.availability);
 const warning = availability.every(value=>value === "NO_XML") ? "MGBI_FINANCIAL_NO_XML" : availability.includes("UNSUPPORTED_XML") ? "MGBI_FINANCIAL_UNSUPPORTED_XML" : availability.includes("UNKNOWN_FORMAT") ? "MGBI_FINANCIAL_UNKNOWN_FORMAT" : null;
 return warning ? {...section,warnings:[...section.warnings.filter(value=>!["MGBI_INTERNATIONAL_STATEMENT_WITHOUT_FACTS","MGBI_NO_STRUCTURED_FINANCIAL_DATA"].includes(value)),warning]} : section;
}
