import { createHash } from "node:crypto";
import type { FinancialData, GeneralCompanyData, SectionEnvelope } from "@profitia/srm-xray";
import { withOrganization } from "./db";
import type { FinancialSourceFact } from "./mgbi-financial";

export const CATALOG_FRESHNESS_MS = 24 * 60 * 60 * 1000;
type GeneralSection = SectionEnvelope<GeneralCompanyData>;
type FinancialSection = SectionEnvelope<FinancialData>;
type CatalogSection = "general" | "financial";

export type SharedCompany = { general: GeneralSection; financial: FinancialSection };

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function isFreshCatalogEntry(checkedAt: Date | string | null, now = new Date()): boolean {
  if (!checkedAt) return false;
  const age = now.getTime() - new Date(checkedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < CATALOG_FRESHNESS_MS;
}

export async function readFreshCompany(organizationId: string, nip: string, now = new Date()): Promise<SharedCompany | null> {
  return withOrganization(organizationId, async (client) => {
    const result = await client.query<{
      general_json: GeneralSection | null; financial_json: FinancialSection | null;
      general_checked_at: Date | null; financial_checked_at: Date | null;
    }>("SELECT general_json, financial_json, general_checked_at, financial_checked_at FROM srm.catalog_companies WHERE nip = $1", [nip]);
    const row = result.rows[0];
    if (!row?.general_json?.data || !row.financial_json ||
      !isFreshCatalogEntry(row.general_checked_at, now) || !isFreshCatalogEntry(row.financial_checked_at, now)) return null;
    if (!Array.isArray(row.financial_json.warnings)) return null;
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
  const hash = sha256({ status: section.status, data: section.data, warnings: section.warnings });
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
    [nip, JSON.stringify(section), hash, new Date(section.retrievedAt), organizationId, snapshotId],
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
         srm.catalog_financial_facts.validation_status)
         IS DISTINCT FROM (EXCLUDED.amount, EXCLUDED.source_amount, EXCLUDED.normalization_rule,
         EXCLUDED.currency_code, EXCLUDED.unit_code, EXCLUDED.source_path, EXCLUDED.validation_status)`,
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
