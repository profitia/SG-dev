import { mapMgbiFinancialRecords } from "../../src/server/mgbi-financial";
import { calculateFinancialIndicators } from "../../src/server/financial-indicators";
import { FINANCIAL_DOCUMENT_MAPPING_VERSION } from "../../src/server/financial-documents";
import { object } from "./bzp";
import { PROJECTION_VERSION } from "./mgbi";

export type Receipt = { nip: string; retrievedAt: string; complete: boolean; count: number; records: unknown[]; projection: string; error?: string };
export function checkReceipt(receipt: Receipt, expectedNip: string): void {
  if (receipt.nip !== expectedNip || receipt.projection !== PROJECTION_VERSION || typeof receipt.complete !== "boolean"
    || !Number.isSafeInteger(receipt.count) || receipt.count < 0 || receipt.count > 10_000 || !Array.isArray(receipt.records)
    || receipt.records.length > receipt.count || receipt.complete && receipt.records.length !== receipt.count
    || receipt.records.some(record => object(object(record).identifiers).pl_nip !== expectedNip || typeof object(record).id !== "string")
    || new Set(receipt.records.map(record => object(record).id)).size !== receipt.records.length
    || typeof receipt.retrievedAt !== "string" || !Number.isFinite(Date.parse(receipt.retrievedAt))) throw new Error("INVALID_OR_MISMATCHED_SAVED_RECEIPT");
}
export function analyze(receipt: Receipt) {
  const flags = new Set<string>();
  const records = receipt.records.map(object);
  if (receipt.error) flags.add(`PROVIDER_${receipt.error}`);
  if (!receipt.complete || records.length !== receipt.count) flags.add("INCOMPLETE_RESPONSE");
  if (records.some(record => object(record.identifiers).pl_nip !== receipt.nip)) flags.add("IDENTIFIER_MISMATCH");
  if (new Set(records.map(record => record.id)).size !== records.length) flags.add("DUPLICATE_RECORD");
  const statements = records.filter(record => ["financial_statement", "consolidated_financial_statement"].includes(String(object(record.document).type)));
  const registrations = [...new Set(statements.map(record => object(record.identifiers).pl_krs).filter((krs): krs is string => typeof krs === "string" && /^\d{10}$/.test(krs)))].sort();
  if (registrations.length > 1) flags.add("MULTIPLE_KRS_REQUIRES_CONTINUITY_REVIEW");
  const filings = new Set<string>();
  let numericStatements = 0;
  const variants = new Set<string>();
  for (const record of statements) {
    const doc = object(record.document), content = object(record.content), schema = object(content.schema);
    const mime = object(object(object(record.files).main_document).original).content_type;
    variants.add([doc.type, mime ?? "UNKNOWN", schema.name ?? "UNKNOWN", schema.version ?? "UNKNOWN", String(doc.is_ias_compliant)].join("|"));
    if (mime === "application/pdf") flags.add("PDF_REQUIRES_SOURCE_FILE");
    else if (mime === "text/html" || mime === "application/xhtml+xml" || doc.is_ias_compliant === true) flags.add("MSR_OR_HTML_REQUIRES_SOURCE_FILE");
    else if (!["text/xml", "application/xml"].includes(String(mime))) flags.add("UNKNOWN_FORMAT");
    if (!doc.period_from_date || !doc.period_to_date || String(doc.period_from_date) > String(doc.period_to_date)) flags.add("INVALID_OR_MISSING_PERIOD");
    if (typeof doc.period_from_date === "string" && typeof doc.period_to_date === "string"
      && (doc.period_from_date.slice(5) !== "01-01" || doc.period_to_date !== `${doc.period_from_date.slice(0, 4)}-12-31`)) flags.add("NON_CALENDAR_OR_NON_ANNUAL_PERIOD");
    const filing = [object(record.identifiers).pl_krs, doc.type, doc.period_from_date, doc.period_to_date].join("|");
    if (filings.has(filing)) flags.add("MULTIPLE_FILINGS_SAME_PERIOD_REQUIRES_REVIEW");
    filings.add(filing);
    if (doc.is_correction === true) flags.add("CORRECTION");
    if (/WTysiacachZlotych$/i.test(String(schema.name))) flags.add("THOUSAND_PLN");
    if (!schema.name || !schema.version) flags.add("MISSING_SCHEMA");
    const numeric = Object.values(object(content.standardized_fields)).some(group => Object.values(object(group)).some(value => value !== null));
    if (numeric) numericStatements++;
    else flags.add("NO_STANDARDIZED_NUMBERS");
  }
  let periods = 0, facts = 0, indicators = 0;
  let replay = "NOT_RUN";
  let projectionReplayWarnings: string[] = [];
  const valid = receipt.complete && receipt.count === records.length && !receipt.error && !flags.has("IDENTIFIER_MISMATCH") && !flags.has("DUPLICATE_RECORD");
  if (valid) {
    try {
      const result = mapMgbiFinancialRecords(records, { type: "NIP", value: receipt.nip }, receipt.retrievedAt, receipt.count);
      periods = result.section.data?.periods.length ?? 0;
      facts = result.facts.length;
      if (result.section.data) indicators = calculateFinancialIndicators(receipt.nip, result.section.data,
        result.facts.map(fact => ({ ...fact, sourceSnapshotId: null }))).length;
      replay = result.errorCode ?? result.section.status;
      projectionReplayWarnings = [...result.section.warnings];
      // Full XML dictionaries and original MSR files are intentionally absent.
      // Empty/partial mapping of this projection is not a proven runtime defect.
      if (statements.length) flags.add("FULL_REPORT_READINESS_NOT_VERIFIED");
    } catch {
      replay = "EXCEPTION_ON_MINIMAL_PROJECTION";
      flags.add("REPLAY_EXCEPTION_REQUIRES_REPRODUCTION");
    }
  }
  const category = !valid ? "ACCESS_OR_RESPONSE_ERROR" : !statements.length ? "NO_FINANCIAL_STATEMENTS_IN_RDF"
    : flags.has("MSR_OR_HTML_REQUIRES_SOURCE_FILE") || flags.has("PDF_REQUIRES_SOURCE_FILE") ? "SOURCE_FILE_REQUIRED_FOR_SOME_REPORTS"
    : numericStatements ? "STRUCTURED_DATA_CANDIDATE" : "NO_STANDARDIZED_NUMBERS";
  return { nip: receipt.nip, category, records: records.length, statements: statements.length, numericStatements,
    registrations, variants: [...variants].sort(), flags: [...flags].sort(), replay, projectionReplayWarnings, periods, facts, indicators,
    mappingVersion: FINANCIAL_DOCUMENT_MAPPING_VERSION, projection: PROJECTION_VERSION,
    fullReportReady: "NOT_VERIFIED", originalDownloadReady: "NOT_VERIFIED", filesDownloaded: 0 };
}
