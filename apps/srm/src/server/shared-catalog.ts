import { createHash } from "node:crypto";
import type { FinancialData, GeneralCompanyData, SectionEnvelope } from "@profitia/srm-xray";
import { withOrganization } from "./db";
import type { FinancialSourceFact } from "./mgbi-financial";
import { calculateFinancialIndicators, FINANCIAL_INDICATOR_INPUT_CODES, type CatalogIndicatorFact } from "./financial-indicators";

export const CATALOG_FRESHNESS_MS = 7 * 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** A shorter setting takes effect for existing entries on the next lookup. */
export function catalogFreshnessMs(env: Readonly<Record<string, string | undefined>> = process.env): number {
  const raw = env.SRM_MGBI_CACHE_TTL_HOURS;
  if (raw === undefined || raw === "") return CATALOG_FRESHNESS_MS;
  const hours = Number(raw);
  if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
    throw new Error("SRM_MGBI_CACHE_TTL_HOURS must be an integer from 1 to 168");
  }
  return hours * HOUR_MS;
}
export const FINANCIAL_MAPPING_VERSION = "2026-10-07-ccc-v2";
type GeneralSection = SectionEnvelope<GeneralCompanyData>;
type FinancialSection = SectionEnvelope<FinancialData>;
type StoredFinancialSection = FinancialSection & { catalogMappingVersion?: string };
type CatalogSection = "general" | "financial";

export type SharedCompany = { general: GeneralSection; financial: FinancialSection };

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function isFreshCatalogEntry(checkedAt: Date | string | null, now = new Date(), ttlMs = catalogFreshnessMs()): boolean {
  if (!checkedAt) return false;
  const age = now.getTime() - new Date(checkedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < ttlMs;
}

export function isCurrentFinancialMapping(section: StoredFinancialSection | null): boolean {
  return section?.catalogMappingVersion === FINANCIAL_MAPPING_VERSION;
}

export async function readFreshCompany(organizationId: string, nip: string, now = new Date()): Promise<SharedCompany | null> {
  return withOrganization(organizationId, async (client) => {
    const result = await client.query<{
      general_json: GeneralSection | null; financial_json: StoredFinancialSection | null;
      general_checked_at: Date | null; financial_checked_at: Date | null;
    }>("SELECT general_json, financial_json, general_checked_at, financial_checked_at FROM srm.catalog_companies WHERE nip = $1", [nip]);
    const row = result.rows[0];
    if (!row?.general_json?.data || !row.financial_json ||
      !isFreshCatalogEntry(row.general_checked_at, now) || !isFreshCatalogEntry(row.financial_checked_at, now)) return null;
    if (!Array.isArray(row.financial_json.warnings) || !isCurrentFinancialMapping(row.financial_json)) return null;
    return { general: row.general_json, financial: row.financial_json };
  });
}

async function upsertSection(
  client: { query: (sql: string, parameters?: unknown[]) => Promise<unknown> },
  nip: string, sectionName: CatalogSection, section: GeneralSection | FinancialSection,
  organizationId: string, snapshotId: string | null,
): Promise<void> {
  if (!section.retrievedAt || (section.status !== "SUCCESS" && section.status !== "PARTIAL" && section.status !== "EMPTY")) return;
  const prefix = sectionName === "general" ? "general" : "financial";
  const payload = sectionName === "financial" ? { ...section, catalogMappingVersion: FINANCIAL_MAPPING_VERSION } : section;
  const hash = sha256({ status: payload.status, data: payload.data, warnings: payload.warnings, catalogMappingVersion: sectionName === "financial" ? FINANCIAL_MAPPING_VERSION : undefined });
  // Only the payload changes on a content delta. checked_at records a successful provider check.
  await client.query(
    `INSERT INTO srm.catalog_companies(nip, ${prefix}_json, ${prefix}_sha256, ${prefix}_checked_at, ${prefix}_source_organization_id, ${prefix}_source_snapshot_id)
     VALUES ($1, $2::jsonb, $3, $4, $5, $6)
     ON CONFLICT (nip) DO UPDATE SET
       ${prefix}_json = CASE WHEN srm.catalog_companies.${prefix}_sha256 IS DISTINCT FROM EXCLUDED.${prefix}_sha256 THEN EXCLUDED.${prefix}_json ELSE srm.catalog_companies.${prefix}_json END,
       ${prefix}_sha256 = EXCLUDED.${prefix}_sha256,
       ${prefix}_checked_at = EXCLUDED.${prefix}_checked_at,
       ${prefix}_source_organization_id = CASE WHEN srm.catalog_companies.${prefix}_sha256 IS DISTINCT FROM EXCLUDED.${prefix}_sha256 THEN EXCLUDED.${prefix}_source_organization_id ELSE srm.catalog_companies.${prefix}_source_organization_id END,
       ${prefix}_source_snapshot_id = CASE WHEN srm.catalog_companies.${prefix}_sha256 IS DISTINCT FROM EXCLUDED.${prefix}_sha256 THEN EXCLUDED.${prefix}_source_snapshot_id ELSE srm.catalog_companies.${prefix}_source_snapshot_id END,
       updated_at = CASE WHEN srm.catalog_companies.${prefix}_sha256 IS DISTINCT FROM EXCLUDED.${prefix}_sha256 THEN now() ELSE srm.catalog_companies.updated_at END`,
    [nip, JSON.stringify(payload), hash, new Date(section.retrievedAt), organizationId, snapshotId],
  );
}

/** Shared password represents one technical actor, not an identified human user. */
export async function recordDemoInterest(organizationId: string, nip: string): Promise<void> {
  await withOrganization(organizationId, async (client) => {
    await client.query("INSERT INTO srm.catalog_companies(nip) VALUES ($1) ON CONFLICT DO NOTHING", [nip]);
    const user = await client.query<{ id: string }>(
      "INSERT INTO srm.users(organization_id, subject_key, identity_kind) VALUES ($1, 'demo-shared', 'SHARED_DEMO') " +
      "ON CONFLICT (organization_id, subject_key) DO UPDATE SET subject_key = EXCLUDED.subject_key RETURNING id",
      [organizationId],
    );
    await client.query(
      "INSERT INTO srm.organization_supplier_interest(organization_id, nip) VALUES ($1, $2) " +
      "ON CONFLICT (organization_id, nip) DO UPDATE SET last_selected_at = now()",
      [organizationId, nip],
    );
    await client.query(
      "INSERT INTO srm.user_supplier_interest(organization_id, user_id, nip) VALUES ($1, $2, $3) " +
      "ON CONFLICT (organization_id, user_id, nip) DO UPDATE SET last_selected_at = now()",
      [organizationId, user.rows[0].id, nip],
    );
  });
}

export async function saveSharedCompany(organizationId: string, nip: string, input: {
  general: GeneralSection; financial: FinancialSection;
  generalSnapshotId: string | null; financialSnapshotId: string | null;
  facts: FinancialSourceFact[];
}): Promise<void> {
  await withOrganization(organizationId, async (client) => {
    await client.query("INSERT INTO srm.catalog_companies(nip) VALUES ($1) ON CONFLICT DO NOTHING", [nip]);
    await upsertSection(client, nip, "general", input.general, organizationId, input.generalSnapshotId);
    await upsertSection(client, nip, "financial", input.financial, organizationId, input.financialSnapshotId);
    if (!input.financialSnapshotId || !input.facts.length || !input.financial.retrievedAt) return;
    const rows = input.facts.map((fact) => ({ ...fact, nip, sourceOrganizationId: organizationId,
      sourceSnapshotId: input.financialSnapshotId, retrievedAt: input.financial.retrievedAt }));
    await client.query(
      `INSERT INTO srm.catalog_financial_facts(nip, metric_code, period_start, period_end, statement_scope,
         period_type, amount, source_amount, normalization_rule, currency_code, unit_code, source_path,
         validation_status, source_organization_id, source_snapshot_id, retrieved_at)
       SELECT f.nip, f.metric_code, f.period_start, f.period_end, f.statement_scope, f.period_type,
         f.amount, f.source_amount, f.normalization_rule, f.currency_code, f.unit_code, f.source_path,
         f.validation_status, f.source_organization_id, f.source_snapshot_id, f.retrieved_at
       FROM jsonb_to_recordset($1::jsonb) AS f(nip text, metric_code text, period_start date, period_end date,
         statement_scope text, period_type text, amount numeric, source_amount numeric, normalization_rule text,
         currency_code text, unit_code text, source_path text, validation_status text,
         source_organization_id uuid, source_snapshot_id uuid, retrieved_at timestamptz)
       ON CONFLICT (nip, metric_code, period_start, period_end, statement_scope) DO UPDATE SET
         amount = EXCLUDED.amount, source_amount = EXCLUDED.source_amount,
         normalization_rule = EXCLUDED.normalization_rule, currency_code = EXCLUDED.currency_code,
         unit_code = EXCLUDED.unit_code, source_path = EXCLUDED.source_path,
         validation_status = EXCLUDED.validation_status,
         source_organization_id = EXCLUDED.source_organization_id,
         source_snapshot_id = EXCLUDED.source_snapshot_id, retrieved_at = EXCLUDED.retrieved_at, updated_at = now()
       WHERE (srm.catalog_financial_facts.amount, srm.catalog_financial_facts.source_amount,
         srm.catalog_financial_facts.normalization_rule, srm.catalog_financial_facts.currency_code,
         srm.catalog_financial_facts.unit_code, srm.catalog_financial_facts.source_path,
         srm.catalog_financial_facts.validation_status, srm.catalog_financial_facts.source_organization_id,
         srm.catalog_financial_facts.source_snapshot_id, srm.catalog_financial_facts.retrieved_at)
         IS DISTINCT FROM (EXCLUDED.amount, EXCLUDED.source_amount, EXCLUDED.normalization_rule,
         EXCLUDED.currency_code, EXCLUDED.unit_code, EXCLUDED.source_path, EXCLUDED.validation_status, EXCLUDED.source_organization_id,
         EXCLUDED.source_snapshot_id, EXCLUDED.retrieved_at)`,
      [JSON.stringify(rows.map((row) => ({ nip: row.nip, metric_code: row.metricCode,
        period_start: row.periodStart, period_end: row.periodEnd, statement_scope: row.statementScope,
        period_type: row.periodType, amount: row.amount, source_amount: row.sourceAmount,
        normalization_rule: row.normalizationRule, currency_code: row.currencyCode,
        unit_code: row.unitCode, source_path: row.sourcePath, validation_status: row.validationStatus,
        source_organization_id: row.sourceOrganizationId, source_snapshot_id: row.sourceSnapshotId,
        retrieved_at: row.retrievedAt })))],
    );
  });
}

/** Recalculate from shared validated facts; persist provenance without another provider call. */
export async function refreshFinancialIndicators(
  organizationId: string, nip: string, data: FinancialData,
): Promise<NonNullable<FinancialData["indicators"]>> {
  return withOrganization(organizationId, async (client) => {
    const found = await client.query<CatalogIndicatorFact>(
      `SELECT metric_code AS "metricCode", period_start::text AS "periodStart", period_end::text AS "periodEnd",
         statement_scope AS "statementScope", amount::text AS amount, currency_code AS "currencyCode",
         unit_code AS "unitCode", source_path AS "sourcePath", validation_status AS "validationStatus",
         normalization_rule AS "normalizationRule", source_snapshot_id::text AS "sourceSnapshotId"
       FROM srm.catalog_financial_facts WHERE nip = $1 AND metric_code = ANY($2::text[])`,
      [nip, FINANCIAL_INDICATOR_INPUT_CODES],
    );
    const calculated = calculateFinancialIndicators(nip, data, found.rows);
    if (calculated.length) {
      await client.query(
        `INSERT INTO srm.catalog_financial_indicators(nip, indicator_code, period_start, period_end,
           statement_scope, formula_version, status, value, unit, importance, reason_code,
           input_facts, source_snapshot_ids, source_document_ids)
         SELECT v.nip, v.indicator_code, v.period_start, v.period_end, v.statement_scope,
           v.formula_version, v.status, v.value, v.unit, v.importance, v.reason_code,
           v.input_facts, v.source_snapshot_ids, v.source_document_ids
         FROM jsonb_to_recordset($1::jsonb) AS v(nip text, indicator_code text, period_start date,
           period_end date, statement_scope text, formula_version text, status text, value numeric,
           unit text, importance smallint, reason_code text, input_facts jsonb,
           source_snapshot_ids uuid[], source_document_ids text[])
         ON CONFLICT (nip, indicator_code, period_start, period_end, statement_scope, formula_version)
         DO UPDATE SET status = EXCLUDED.status, value = EXCLUDED.value, unit = EXCLUDED.unit,
           importance = EXCLUDED.importance, reason_code = EXCLUDED.reason_code,
           input_facts = EXCLUDED.input_facts, source_snapshot_ids = EXCLUDED.source_snapshot_ids,
           source_document_ids = EXCLUDED.source_document_ids, computed_at = now()
         WHERE (srm.catalog_financial_indicators.status, srm.catalog_financial_indicators.value,
           srm.catalog_financial_indicators.unit, srm.catalog_financial_indicators.importance,
           srm.catalog_financial_indicators.reason_code, srm.catalog_financial_indicators.input_facts,
           srm.catalog_financial_indicators.source_snapshot_ids, srm.catalog_financial_indicators.source_document_ids)
           IS DISTINCT FROM (EXCLUDED.status, EXCLUDED.value, EXCLUDED.unit, EXCLUDED.importance,
           EXCLUDED.reason_code, EXCLUDED.input_facts, EXCLUDED.source_snapshot_ids, EXCLUDED.source_document_ids)`,
        [JSON.stringify(calculated.map((item) => ({
          nip, indicator_code: item.code, period_start: item.periodStart, period_end: item.periodEnd,
          statement_scope: item.scope === "standalone" ? "UNIT" : "CONSOLIDATED",
          formula_version: item.formulaVersion, status: item.status, value: item.value,
          unit: item.unit, importance: item.importance, reason_code: item.reasonCode,
          input_facts: item.inputFacts, source_snapshot_ids: item.sourceSnapshotIds,
          source_document_ids: item.sourceDocumentIds,
        })))],
      );
    }
    return calculated.map(({ inputFacts: _inputFacts, sourceSnapshotIds: _sourceSnapshotIds,
      sourceDocumentIds: _sourceDocumentIds, nip: _nip, ...publicResult }) => publicResult);
  });
}
