import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { withOrganization, type DatabasePool } from "./db";
import { kysCacheTtlMs } from "./kys-cache";

export type Identifier = { type: "NIP" | "KRS"; value: string };
export type Section = "general" | "financial" | "kys";
export type PersistedSection = Section | "jdg";
export type TerminalStatus = "SUCCESS" | "NO_DATA" | "TIMEOUT" | "ERROR";


export async function createLookup(organizationId: string, identifier: Identifier, entityType: "COMPANY" | "JDG" = "COMPANY", pool?: DatabasePool): Promise<{ supplierId: string; requestId: string }> {
  if (!/^[0-9]{10}$/.test(identifier.value)) throw new Error("NIP or KRS must have ten digits");
  return withOrganization(organizationId, async (client) => {
    const column = identifier.type === "NIP" ? "nip" : "krs";
    const supplier = await client.query<{ id: string }>(
      "INSERT INTO srm.suppliers(organization_id, " + column + ") VALUES ($1, $2) " +
      "ON CONFLICT (organization_id, " + column + ") WHERE " + column + " IS NOT NULL " +
      "DO UPDATE SET updated_at = now() RETURNING id",
      [organizationId, identifier.value],
    );
    const request = await client.query<{ id: string }>(
      "INSERT INTO srm.lookup_requests(organization_id, supplier_id, identifier_type, identifier, entity_type) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [organizationId, supplier.rows[0].id, identifier.type, identifier.value, entityType],
    );
    return { supplierId: supplier.rows[0].id, requestId: request.rows[0].id };
  }, pool);
}

export async function startAttempt(organizationId: string, requestId: string, section: PersistedSection, attemptNo = 1,
  retrievalMethod: "PROVIDER" | "CACHE" = "PROVIDER"): Promise<string> {
  const provider = section === "kys" ? "VERCLY" : section === "jdg" ? "CEIDG" : "MGBI";
  return withOrganization(organizationId, async (client) => {
    const result = await client.query<{ id: string }>(
      "INSERT INTO srm.provider_attempts(organization_id, request_id, section, provider, attempt_no, status, retrieval_method) VALUES ($1, $2, $3, $4, $5, 'PENDING', $6) RETURNING id",
      [organizationId, requestId, section, provider, attemptNo, retrievalMethod],
    );
    return result.rows[0].id;
  });
}

export async function finishAttempt(
  organizationId: string,
  attemptId: string,
  status: TerminalStatus,
  details: { correlationId?: string; providerRecordId?: string; errorCode?: string } = {},
): Promise<void> {
  await withOrganization(organizationId, async (client) => {
    const result = await client.query(
      "UPDATE srm.provider_attempts SET status = $3, completed_at = now(), correlation_id = $4, " +
      "provider_record_id = $5, error_code = $6 WHERE organization_id = $1 AND id = $2 AND status = 'PENDING'",
      [organizationId, attemptId, status, details.correlationId ?? null, details.providerRecordId ?? null, details.errorCode ?? null],
    );
    if (result.rowCount !== 1) throw new Error("Attempt missing, foreign or already completed");
  });
}

export interface SnapshotInput {
  attemptId: string;
  supplierId: string;
  section: PersistedSection;
  sourceRecordId?: string;
  dataClass: "COMPANY" | "FINANCIAL" | "KYS_REDACTED" | "KYS_PERSONAL" | "JDG_REGISTRY";
  payload: unknown;
  retrievedAt: Date;
  effectiveAt?: Date;
  retentionUntil?: Date;
}

export async function appendSnapshot(organizationId: string, input: SnapshotInput): Promise<string> {
  if (input.section === "kys" && !["KYS_REDACTED", "KYS_PERSONAL"].includes(input.dataClass)) throw new Error("KYS snapshots must use a classified projection");
  if (input.dataClass === "KYS_PERSONAL" && (!input.retentionUntil ||
    input.retentionUntil.getTime() > input.retrievedAt.getTime() + 7 * 24 * 60 * 60 * 1000)) {
    throw new Error("KYS personal snapshots require retention of at most seven days");
  }
  if (input.section === "jdg" && input.dataClass !== "JDG_REGISTRY") throw new Error("JDG snapshots must use the registry data class");
  const serialized = JSON.stringify(input.payload);
  if (!serialized) throw new Error("Snapshot payload is required");
  const digest = createHash("sha256").update(serialized).digest("hex");
  return withOrganization(organizationId, async (client) => {
    const result = await client.query<{ id: string }>(
      "INSERT INTO srm.source_snapshots(organization_id, attempt_id, supplier_id, section, source_record_id, " +
      "payload_json, payload_sha256, data_class, retrieved_at, effective_at, retention_until) " +
      "VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11) RETURNING id",
      [organizationId, input.attemptId, input.supplierId, input.section, input.sourceRecordId ?? null,
        serialized, digest, input.dataClass, input.retrievedAt, input.effectiveAt ?? null, input.retentionUntil ?? null],
    );
    return result.rows[0].id;
  });
}

export async function purgeExpiredKysPersonal(organizationId: string): Promise<void> {
  await withOrganization(organizationId, async (client) => {
    const expired = "SELECT id FROM srm.source_snapshots WHERE organization_id = $1 AND data_class = 'KYS_PERSONAL' AND retention_until < now()";
    await client.query(`DELETE FROM srm.section_projections WHERE organization_id = $1 AND snapshot_id IN (${expired})`, [organizationId]);
    await client.query(`DELETE FROM srm.source_snapshots WHERE organization_id = $1 AND data_class = 'KYS_PERSONAL' AND retention_until < now()`, [organizationId]);
  });
}

export async function readKysPersonPesel(
  organizationId: string, snapshotId: string, list: "relatedPersons" | "beneficialOwners", index: number,
): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(snapshotId) || !Number.isSafeInteger(index) || index < 0 || index > 10000) return null;
  return withOrganization(organizationId, async (client) => {
    const result = await client.query<{ payload_json: { relatedPersons?: { pesel?: unknown }[]; beneficialOwners?: { pesel?: unknown }[] } }>(
      "SELECT payload_json FROM srm.source_snapshots WHERE organization_id = $1 AND id = $2 " +
      "AND section = 'kys' AND data_class = 'KYS_PERSONAL' AND retention_until > now() " +
      "AND retrieved_at + ($3::bigint * interval '1 millisecond') > now()",
      [organizationId, snapshotId, kysCacheTtlMs()],
    );
    const pesel = result.rows[0]?.payload_json?.[list]?.[index]?.pesel;
    return typeof pesel === "string" && /^\d{11}$/.test(pesel) ? pesel : null;
  });
}

export async function appendSectionProjection(
  organizationId: string,
  input: { supplierId: string; snapshotId: string; section: PersistedSection; data: unknown; version: number },
): Promise<string> {
  const serialized = JSON.stringify(input.data);
  if (!serialized || !Number.isSafeInteger(input.version) || input.version < 1) throw new Error("A valid projection is required");
  return withOrganization(organizationId, async (client) => {
    const result = await client.query<{ id: string }>(
      "INSERT INTO srm.section_projections(organization_id, supplier_id, snapshot_id, section, projection_version, data_json) " +
      "VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id",
      [organizationId, input.supplierId, input.snapshotId, input.section, input.version, serialized],
    );
    return result.rows[0].id;
  });
}

export interface FinancialFactInput {
  supplierId: string;
  snapshotId: string;
  metricCode: string;
  periodStart: string;
  periodEnd: string;
  periodType: "YEAR" | "QUARTER" | "MONTH" | "OTHER";
  statementScope: "UNIT" | "CONSOLIDATED" | "UNKNOWN";
  amount: string;
  sourceAmount: string;
  normalizationRule: "SOURCE_VALUE" | "VERIFIED_COST_MAGNITUDE_V1" | "UNVERIFIED_COST_SIGN";
  currencyCode?: string;
  unitCode: string;
  sourcePath: string;
  validationStatus: "VALID" | "REVIEW" | "REJECTED";
}

export async function appendFinancialFacts(organizationId: string, facts: FinancialFactInput[]): Promise<void> {
  if (!facts.length) return;
  const { supplierId, snapshotId } = facts[0];
  if (facts.some((fact) => fact.supplierId !== supplierId || fact.snapshotId !== snapshotId)) throw new Error("Financial facts must belong to one snapshot");
  const rows = facts.map((fact) => ({
    metric_code: fact.metricCode, period_start: fact.periodStart, period_end: fact.periodEnd,
    period_type: fact.periodType, statement_scope: fact.statementScope, amount: fact.amount,
    source_amount: fact.sourceAmount, normalization_rule: fact.normalizationRule,
    currency_code: fact.currencyCode ?? null, unit_code: fact.unitCode,
    source_path: fact.sourcePath, validation_status: fact.validationStatus,
  }));
  await withOrganization(organizationId, async (client) => {
    await client.query(
      "INSERT INTO srm.financial_facts(organization_id, supplier_id, snapshot_id, metric_code, " +
      "period_start, period_end, period_type, statement_scope, amount, source_amount, normalization_rule, currency_code, unit_code, source_path, validation_status) " +
      "SELECT $1, $2, $3, f.metric_code, f.period_start, f.period_end, f.period_type, f.statement_scope, " +
      "f.amount, f.source_amount, f.normalization_rule, f.currency_code, f.unit_code, f.source_path, f.validation_status " +
      "FROM jsonb_to_recordset($4::jsonb) AS f(metric_code text, period_start date, period_end date, " +
      "period_type text, statement_scope text, amount numeric, source_amount numeric, normalization_rule text, currency_code text, unit_code text, " +
      "source_path text, validation_status text)",
      [organizationId, supplierId, snapshotId, JSON.stringify(rows)],
    );
  });
}
