import { productEnvironmentReady, productOrganizationId } from "./runtime-environment";
import { createHash } from "node:crypto";
import { kysExportRef } from "./kys-pdf-access";
import type { FinancialData, FinancialFactEvidence, FinancialHistoryPoint, FinancialIndicatorResult, FinancialPeriod, ReportFreshness, SectionEnvelope, SupplierReportData } from "@profitia/srm-xray";
import { withOrganization, type DatabasePool } from "./db";
import { definitions, FINANCIAL_INDICATOR_CODES, FINANCIAL_INDICATOR_FORMULA_VERSION, selectedPeriods, type CalculatedFinancialIndicator, type CatalogIndicatorFact } from "./financial-indicators";
import { catalogFreshnessMs, FINANCIAL_MAPPING_VERSION, isFreshCatalogEntry } from "./shared-catalog";
import { isFreshKys, kysCacheTtlMs } from "./kys-cache";
import { hasDemoSession } from "./demo-auth";
import { isSameOriginRequest } from "./request-origin";
import { validateXrayRequest } from "./xray-lookup";

export type ReportSelection = { nip: string; entityType: "COMPANY" | "JDG" };
type StoredFinancial = SectionEnvelope<FinancialData> & { catalogMappingVersion?: string };
export type ReportReadRow = {
  nip: string;
  financial_json: StoredFinancial | null;
  financial_sha256: string | null;
  financial_checked_at: string | Date | null;
  facts: Array<CatalogIndicatorFact & { sourceAmount: string }>;
  indicators: CalculatedFinancialIndicator[];
  kys: null | {
    attemptStatus: SupplierReportData["kys"]["lastAttemptStatus"];
    attemptAt: string | null;
    retrievalMethod: "PROVIDER" | "CACHE";
    retrievedAt: string | null;
    retentionUntil: string | null;
    isComplete: boolean | null;
    hasProjection: boolean;
    currentProjection: boolean;
    completionConfirmed: boolean;
    snapshotId?: string | null; projectionVersion?: number | null; projectionHash?: string | null; dataClass?: string | null;
  };
};

const DAY_MS = 86_400_000;
function opaque(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function iso(value: string | Date | null | undefined): string | null {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
function decimal(value: string): bigint | null {
  if (!/^-?\d{1,24}(?:\.\d{1,6})?$/.test(value)) return null;
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const scaled = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
  return negative ? -scaled : scaled;
}
function difference(current: string, previous: string): { delta: string; direction: "UP" | "DOWN" | "UNCHANGED" } | null {
  const a = decimal(current), b = decimal(previous);
  if (a === null || b === null) return null;
  const delta = a - b, magnitude = delta < 0n ? -delta : delta;
  return { delta: `${delta < 0n ? "-" : ""}${magnitude / 1_000_000n}.${String(magnitude % 1_000_000n).padStart(6, "0")}`,
    direction: delta > 0n ? "UP" : delta < 0n ? "DOWN" : "UNCHANGED" };
}
// MGBI mapping appends :cfy/:pfy to one filing ID; these are not separate documents.
function documentRef(nip: string, period: FinancialPeriod): string {
  return opaque(["financial-document", nip, period.scope, period.documentId.replace(/:(cfy|pfy)$/, "")]);
}
function periodKey(from: string, to: string, scope: FinancialPeriod["scope"]): string { return `${from}:${to}:${scope}`; }
function annual(point: FinancialIndicatorResult): boolean {
  const from = Date.parse(`${point.periodStart}T00:00:00Z`), to = Date.parse(`${point.periodEnd}T00:00:00Z`);
  const days = (to - from) / DAY_MS + 1;
  return Number.isInteger(days) && days >= 365 && days <= 366;
}

/** A difference is presentation arithmetic over stored values, never a financial formula. */
export function compareHistoryPoints(current: FinancialHistoryPoint, previous?: FinancialHistoryPoint): FinancialHistoryPoint["comparison"] {
  const unit = current.unit === "PERCENT" ? "PERCENTAGE_POINTS" : current.unit;
  const base: FinancialHistoryPoint["comparison"] = { status: "NOT_COMPARABLE", reasonCode: "NO_PREVIOUS_PERIOD", previousPeriod: previous ? { from: previous.periodStart, to: previous.periodEnd } : null,
    delta: null, unit, direction: "NO_COMPARISON" };
  if (!previous) return base;
  const reject = (reasonCode: string, status: "NOT_COMPARABLE" | "UNKNOWN" = "NOT_COMPARABLE") => ({ ...base, status, reasonCode });
  if (current.code !== previous.code || current.scope !== previous.scope || current.unit !== previous.unit) return reject("INDICATOR_SCOPE_OR_UNIT_MISMATCH");
  if (!current.formulaVersion || current.formulaVersion !== previous.formulaVersion) return reject("METHODOLOGY_MISMATCH");
  if (!annual(current) || !annual(previous)) return reject("PERIOD_NOT_ANNUAL");
  if (Date.parse(`${previous.periodEnd}T00:00:00Z`) + DAY_MS !== Date.parse(`${current.periodStart}T00:00:00Z`)) return reject("NON_ADJACENT_PERIODS");
  if (current.status !== "AVAILABLE" || previous.status !== "AVAILABLE" || current.value === null || previous.value === null) return reject("VALUE_UNAVAILABLE");
  if (!current.evidence.length || !previous.evidence.length || [...current.evidence, ...previous.evidence].some(f => f.validation !== "VERIFIED")) return reject("EVIDENCE_UNVERIFIED", "UNKNOWN");
  // A shared selected document proves co-reported current/prior years. Separate
  // filings have no persisted correction/basis lineage: do not invent that proof.
  if (current.documentRef !== previous.documentRef) return reject("DOCUMENT_COMPARABILITY_UNCONFIRMED", "UNKNOWN");
  const change = difference(current.value, previous.value);
  return change ? { ...base, status: "COMPARABLE", reasonCode: null, ...change } : reject("INVALID_STORED_VALUE");
}

function factEvidence(nip: string, period: FinancialPeriod, displayed: FinancialPeriod["facts"][number], stored: ReportReadRow["facts"][number] | undefined, mappingCurrent: boolean): FinancialFactEvidence {
  const reference = documentRef(nip, period);
  const normalization = stored?.normalizationRule === "VERIFIED_COST_MAGNITUDE_V1" ? "NORMALIZED_CONFIRMED"
    : stored?.normalizationRule === "SOURCE_VALUE" ? "SOURCE_VALUE"
      : stored?.normalizationRule === "UNVERIFIED_COST_SIGN" ? "SOURCE_UNCONFIRMED" : "UNKNOWN";
  const matches = Boolean(stored?.sourceSnapshotId && decimal(stored.amount) !== null && decimal(stored.amount) === decimal(displayed.amount)
    && stored.currencyCode === displayed.currency && stored.unitCode === displayed.unit);
  const verified = mappingCurrent && matches && stored?.validationStatus === "VALID" && normalization !== "UNKNOWN" && normalization !== "SOURCE_UNCONFIRMED";
  return { ref: opaque([reference, period.from, period.to, displayed.metricCode]), documentRef: reference,
    metricCode: displayed.metricCode, periodStart: period.from, periodEnd: period.to, scope: period.scope,
    amount: displayed.amount, sourceAmount: matches ? stored!.sourceAmount : null, currency: displayed.currency, unit: displayed.unit,
    validation: !stored ? "UNAVAILABLE" : verified ? "VERIFIED" : "UNVERIFIED", normalization,
    normalizationRule: stored?.normalizationRule ?? null,
    reasonCode: !stored ? "SOURCE_FACT_NOT_STORED" : !mappingCurrent ? "MAPPING_VERSION_OUTDATED" : !matches ? "REPRESENTATION_MISMATCH"
      : verified ? null : "SOURCE_VALIDATION_UNCONFIRMED" };
}

/** Allowlisted projection. Neither source paths, snapshot UUIDs nor provider JSON leave this function. */
export function projectReportData(selection: ReportSelection, row: ReportReadRow, now = new Date(), env: Readonly<Record<string, string | undefined>> = process.env): SupplierReportData {
  if (row.nip !== selection.nip || row.indicators.some(i => i.nip !== selection.nip)) throw new Error("Report supplier identity mismatch");
  const section = selection.entityType === "COMPANY" ? row.financial_json : null;
  const mappingCurrent = section?.catalogMappingVersion === FINANCIAL_MAPPING_VERSION;
  const selected = section?.data ? selectedPeriods(section.data) : [];
  const factMap = new Map(row.facts.map(f => [`${f.periodStart}:${f.periodEnd}:${f.statementScope === "UNIT" ? "standalone" : f.statementScope === "CONSOLIDATED" ? "consolidated" : "unknown"}:${f.metricCode}`, f]));
  const quality = new Map<string, FinancialFactEvidence>();
  const periods = selected.map(period => ({ from: period.from, to: period.to, year: period.to.slice(0, 4), scope: period.scope,
    documentRef: documentRef(selection.nip, period),
    facts: period.facts.map(displayed => {
      const key = `${periodKey(period.from, period.to, period.scope)}:${displayed.metricCode}`;
      const result = factEvidence(selection.nip, period, displayed, factMap.get(key), Boolean(mappingCurrent));
      quality.set(key, result);
      return result;
    }) }));
  const documents = new Map(selected.map(p => [periodKey(p.from, p.to, p.scope), p]));
  const stored = new Map(row.indicators.filter(i => i.formulaVersion === FINANCIAL_INDICATOR_FORMULA_VERSION)
    .map(i => [`${periodKey(i.periodStart, i.periodEnd, i.scope)}:${i.code}`, i]));
  const history = FINANCIAL_INDICATOR_CODES.map(code => {
    const definition = definitions.find(d => d.code === code)!;
    const points: FinancialHistoryPoint[] = [];
    for (const period of selected) {
      const result = stored.get(`${periodKey(period.from, period.to, period.scope)}:${code}`);
      const evidence: FinancialFactEvidence[] = [];
      let evidenceValid = Boolean(result?.inputFacts.length);
      for (const input of result?.inputFacts ?? []) {
        const sourcePeriod = documents.get(periodKey(input.periodStart, input.periodEnd, period.scope));
        const key = `${periodKey(input.periodStart, input.periodEnd, period.scope)}:${input.metricCode}`;
        const fact = factMap.get(key), publicFact = quality.get(key);
        if (!sourcePeriod || sourcePeriod.documentId !== input.documentId || !fact || fact.sourceSnapshotId !== input.sourceSnapshotId
          || !publicFact || publicFact.validation !== "VERIFIED" || decimal(input.amount) === null || decimal(input.amount) !== decimal(publicFact.amount)) {
          evidenceValid = false;
          continue;
        }
        evidence.push(publicFact);
      }
      const matchesDefinition = result?.unit === definition.unit && result?.importance === definition.importance;
      const reasonCode = !result ? "CALCULATION_NOT_STORED" : result.status === "UNAVAILABLE" ? result.reasonCode
        : !mappingCurrent ? "MAPPING_VERSION_OUTDATED" : !matchesDefinition ? "INDICATOR_CONTRACT_MISMATCH"
          : !evidenceValid ? "STORED_EVIDENCE_MISMATCH" : result.value === null || decimal(result.value) === null ? "INVALID_STORED_VALUE" : null;
      const point: FinancialHistoryPoint = { code, periodStart: period.from, periodEnd: period.to, scope: period.scope,
        status: reasonCode === null ? "AVAILABLE" : "UNAVAILABLE", value: reasonCode === null ? result!.value : null,
        unit: definition.unit, importance: definition.importance, reasonCode,
        formulaVersion: result?.formulaVersion ?? FINANCIAL_INDICATOR_FORMULA_VERSION,
        year: period.to.slice(0, 4), documentRef: documentRef(selection.nip, period),
        definitionRef: { code, formulaVersion: result?.formulaVersion ?? FINANCIAL_INDICATOR_FORMULA_VERSION }, evidence,
        comparison: { status: "NOT_COMPARABLE", reasonCode: "NO_PREVIOUS_PERIOD", previousPeriod: null, delta: null,
          unit: definition.unit === "PERCENT" ? "PERCENTAGE_POINTS" : definition.unit, direction: "NO_COMPARISON" } };
      points.push(point);
    }
    // Newest first; never bridge a missing/unavailable year or a reporting scope.
    for (const point of points) point.comparison = compareHistoryPoints(point, points.find(p => p.scope === point.scope && p.periodEnd < point.periodEnd));
    return { code, reasonCode: points.length ? null : selection.entityType === "JDG" ? "JDG_FINANCIAL_REPORT_NOT_AVAILABLE" : "NO_STORED_FINANCIAL_PERIODS", points };
  });
  const financialTtl = catalogFreshnessMs(env), checkedAt = section ? iso(row.financial_checked_at) : null;
  const financialFreshness: ReportFreshness = { retrievedAt: iso(section?.retrievedAt), checkedAt,
    cacheExpiresAt: checkedAt ? new Date(Date.parse(checkedAt) + financialTtl).toISOString() : null,
    retentionUntil: null, readSource: "STORED", lastRetrievalMethod: "UNKNOWN",
    freshness: !section ? "ABSENT" : !checkedAt || Date.parse(checkedAt) > now.getTime() ? "UNKNOWN" : isFreshCatalogEntry(checkedAt, now, financialTtl) ? "FRESH" : "EXPIRED" };
  const limitations: string[] = [];
  if (section && !mappingCurrent) limitations.push("MAPPING_VERSION_OUTDATED");
  if (periods.some(p => p.facts.some(f => f.validation !== "VERIFIED"))) limitations.push("FINANCIAL_FACTS_UNVERIFIED");
  if (financialFreshness.freshness === "EXPIRED") limitations.push("FINANCIAL_CACHE_EXPIRED");
  const sourceVersion = section && row.financial_sha256 ? opaque([selection.nip, row.financial_sha256, section.catalogMappingVersion]) : null;
  const financial: SupplierReportData["financial"] = { status: section?.status ?? "NOT_REQUESTED", source: "MGBI", freshness: financialFreshness,
    completeness: !section ? "UNKNOWN" : !periods.length ? "EMPTY"
      : section.status === "SUCCESS" && periods.every(p => p.facts.length && p.facts.every(f => f.validation === "VERIFIED")) ? "COMPLETE" : "PARTIAL",
    limitations, mappingVersion: section?.catalogMappingVersion ?? null, sourceVersion,
    representationVersion: section ? opaque([selection.nip, sourceVersion, periods, history]) : null, periods, history };
  const k = row.kys, retrievedAt = iso(k?.retrievedAt), retentionUntil = iso(k?.retentionUntil), ttl = kysCacheTtlMs(env);
  const cacheExpiresAt = retrievedAt && retentionUntil ? new Date(Math.min(Date.parse(retentionUntil), Date.parse(retrievedAt) + ttl)).toISOString() : null;
  const fresh = isFreshKys(retrievedAt, retentionUntil, now, ttl);
  const kysStatus = k?.hasProjection ? k.isComplete === true && k.completionConfirmed && k.currentProjection ? "SUCCESS" : "PARTIAL"
    : !k ? "NOT_REQUESTED" : k.attemptStatus === "PENDING" ? "PENDING" : k.attemptStatus === "NO_DATA" ? "EMPTY" : "ERROR";
  return { schemaVersion: "1.0", ...selection, financial, kys: { status: kysStatus, source: "VERCLY",
    freshness: { retrievedAt, checkedAt: null, cacheExpiresAt, retentionUntil, readSource: "STORED",
      lastRetrievalMethod: k?.retrievalMethod ?? "UNKNOWN", freshness: !k ? "ABSENT" : !retrievedAt || !retentionUntil || Date.parse(retrievedAt) > now.getTime() ? "UNKNOWN" : fresh ? "FRESH" : "EXPIRED" },
    completeness: !k?.hasProjection || !fresh ? "UNKNOWN" : k.isComplete === false ? "PARTIAL" : k.completionConfirmed && k.currentProjection ? "COMPLETE" : "UNKNOWN",
    lastAttemptStatus: k?.attemptStatus ?? null, lastAttemptAt: iso(k?.attemptAt),
    limitations: !k ? ["KYS_NOT_REQUESTED"] : !k.hasProjection ? ["KYS_REPORT_UNAVAILABLE"] : !fresh ? ["KYS_REPORT_EXPIRED_OR_FRESHNESS_UNKNOWN"]
      : !k.currentProjection ? ["KYS_PROJECTION_OUTDATED"] : k.isComplete !== true ? ["KYS_INCOMPLETE_SOURCES"] : !k.completionConfirmed ? ["KYS_COMPLETENESS_UNCONFIRMED"] : [], reportAvailable: Boolean(k?.hasProjection && k.currentProjection && fresh) } };
}

/** One PostgreSQL statement gives a coherent snapshot; no cache writes, leases, purges or calculations. */
export const REPORT_DATA_SQL = `SELECT requested.nip, c.financial_json, c.financial_sha256, c.financial_checked_at,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('metricCode', f.metric_code, 'periodStart', f.period_start::text,
    'periodEnd', f.period_end::text, 'statementScope', f.statement_scope, 'amount', f.amount::text,
    'sourceAmount', f.source_amount::text, 'currencyCode', f.currency_code, 'unitCode', f.unit_code,
    'sourcePath', f.source_path, 'validationStatus', f.validation_status, 'normalizationRule', f.normalization_rule,
    'sourceSnapshotId', f.source_snapshot_id::text)) FROM srm.catalog_financial_facts f WHERE f.nip = requested.nip AND $3 = 'COMPANY'), '[]'::jsonb) AS facts,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('nip', i.nip, 'code', i.indicator_code,
    'periodStart', i.period_start::text, 'periodEnd', i.period_end::text, 'scope', CASE i.statement_scope WHEN 'UNIT' THEN 'standalone' ELSE 'consolidated' END,
    'formulaVersion', i.formula_version, 'status', i.status, 'value', i.value::text, 'unit', i.unit,
    'importance', i.importance, 'reasonCode', i.reason_code, 'inputFacts', i.input_facts,
    'sourceSnapshotIds', i.source_snapshot_ids, 'sourceDocumentIds', i.source_document_ids))
    FROM srm.catalog_financial_indicators i WHERE i.nip = requested.nip AND i.formula_version = $4 AND $3 = 'COMPANY'), '[]'::jsonb) AS indicators,
  k.metadata AS kys
FROM (VALUES ($1::text)) requested(nip)
LEFT JOIN srm.catalog_companies c ON c.nip = requested.nip AND $3 = 'COMPANY'
LEFT JOIN LATERAL (
  SELECT jsonb_build_object('attemptStatus', a.status, 'attemptAt', a.completed_at,
    'retrievalMethod', a.retrieval_method, 'retrievedAt', s.retrieved_at, 'retentionUntil', s.retention_until,
    'isComplete', p.data_json->'isComplete', 'hasProjection', p.snapshot_id IS NOT NULL,
    'snapshotId', s.id::text, 'projectionVersion', p.projection_version, 'projectionHash', md5(p.data_json::text || COALESCE((SELECT (kw.report_json->'warnings')::text FROM srm.catalog_kys_reports kw WHERE kw.nip=requested.nip AND kw.entity_type=$3 AND kw.report_json->'data'=p.data_json), '[]')), 'dataClass', s.data_class,
    'currentProjection', COALESCE(jsonb_typeof(p.data_json->'pepMatches') = 'array', false),
    'completionConfirmed', EXISTS (SELECT 1 FROM srm.catalog_kys_reports kc
      WHERE kc.nip = requested.nip AND kc.entity_type = $3
        AND kc.report_json->>'status' = 'SUCCESS' AND kc.report_json->'data' = p.data_json)) AS metadata
  FROM srm.lookup_requests l JOIN srm.provider_attempts a ON a.organization_id = l.organization_id AND a.request_id = l.id AND a.section = 'kys'
  LEFT JOIN srm.source_snapshots s ON s.organization_id = a.organization_id AND s.attempt_id = a.id AND s.supplier_id = l.supplier_id AND s.section = 'kys'
  LEFT JOIN srm.section_projections p ON p.organization_id = s.organization_id AND p.snapshot_id = s.id AND p.supplier_id = s.supplier_id AND p.section = 'kys'
  WHERE l.organization_id = $2::uuid AND l.identifier_type = 'NIP' AND l.identifier = requested.nip AND l.entity_type = $3
  ORDER BY l.requested_at DESC, a.started_at DESC, p.projection_version DESC LIMIT 1
) k ON true`;

export async function readReportData(organizationId: string, selection: ReportSelection, now = new Date(), pool?: DatabasePool): Promise<SupplierReportData> {
  return withOrganization(organizationId, async client => {
    const result = await client.query<ReportReadRow>(REPORT_DATA_SQL, [selection.nip, organizationId, selection.entityType, FINANCIAL_INDICATOR_FORMULA_VERSION]);
    const row = result.rows[0];
    const report = projectReportData(selection, row, now);
    report.kys.exportRef = report.kys.reportAvailable && row.kys ? kysExportRef(organizationId, selection, row.kys, process.env.SRM_DEMO_SESSION_SECRET) : null;
    return report;
  }, pool);
}

export function validateReportSelection(input: unknown): ReportSelection {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Nieprawidłowy wybór raportu.");
  const value = input as Record<string, unknown>;
  const nip = validateXrayRequest({ identifier: value.nip }).identifier.value;
  if (value.entityType !== undefined && value.entityType !== "COMPANY" && value.entityType !== "JDG") throw new Error("Nieprawidłowy rodzaj dostawcy.");
  return { nip, entityType: value.entityType === "JDG" ? "JDG" : "COMPANY" };
}

/** Same host boundary as the existing exports; injectable read only for contract tests. */
export function reportDataHandler(read = readReportData, env: Readonly<Record<string, string | undefined>> = process.env) {
  return async (request: Request): Promise<Response> => {
    const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
    if (!productEnvironmentReady(env)) return respond({ error: "Środowisko niedostępne." }, 404);
    if (!await hasDemoSession(request, { SRM_DEMO_PASSWORD: env.SRM_DEMO_PASSWORD, SRM_DEMO_SESSION_SECRET: env.SRM_DEMO_SESSION_SECRET })) return respond({ error: "Wymagane logowanie." }, 401);
    if (!isSameOriginRequest(request)) return respond({ error: "Nieprawidłowe żądanie." }, 403);
    const organizationId = productOrganizationId(env);
    if (!organizationId) return respond({ error: "Środowisko SRM nie jest skonfigurowane." }, 503);
    let selection: ReportSelection;
    try { selection = validateReportSelection(await request.json()); }
    catch { return respond({ error: "Nieprawidłowy NIP lub rodzaj dostawcy." }, 400); }
    try { return respond(await read(organizationId, selection)); }
    catch { return respond({ error: "Nie udało się odczytać zapisanego raportu." }, 503); }
  };
}
