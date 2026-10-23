import { createHash } from "node:crypto";
import { operationPayloadDigest, type Json } from "@profitia/platform-contracts/operation-context";
import type { PoolClient } from "pg";
import { withOrganization, type DatabasePool } from "./db";
import { kysCacheTtlMs } from "./kys-cache";
import {measureSupplierStage} from './supplier-telemetry';

export type Identifier = { type: "NIP" | "KRS"; value: string };
export type Section = "general" | "financial" | "kys";
export type PersistedSection = Section | "jdg";
export type TerminalStatus = "SUCCESS" | "NO_DATA" | "TIMEOUT" | "ERROR";


export type ExistingSupplierRegistration = 'TOUCH' | 'KEEP';
export async function createLookup(organizationId: string, identifier: Identifier, entityType: "COMPANY" | "JDG" = "COMPANY", pool?: DatabasePool, acceptedRequestId?: string, existingSupplier: ExistingSupplierRegistration = 'TOUCH'): Promise<{ supplierId: string; requestId: string }> {
  if (acceptedRequestId !== undefined && (!pool || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(acceptedRequestId))) throw new Error("A bound accepted request UUID is required");
  if (!['TOUCH','KEEP'].includes(existingSupplier) || existingSupplier === 'KEEP' && acceptedRequestId === undefined) throw new Error("A bound accepted request UUID is required");
  if (!/^[0-9]{10}$/.test(identifier.value)) throw new Error("NIP or KRS must have ten digits");
  return withOrganization(organizationId, async (client) => {
    const column = identifier.type === "NIP" ? "nip" : "krs";
    const supplier = await client.query<{ id: string }>(
      "INSERT INTO srm.suppliers(organization_id, " + column + ") VALUES ($1, $2) " +
      "ON CONFLICT (organization_id, " + column + ") WHERE " + column + " IS NOT NULL " +
      (existingSupplier === 'KEEP' ? "DO NOTHING RETURNING id" : "DO UPDATE SET updated_at = now() RETURNING id"),
      [organizationId, identifier.value],
    );
    // KRS Financial needs the current supplier identity, not an update of its
    // registry record. A separate statement sees a concurrent committed insert;
    // the same tenant RLS still controls both creation and selection.
    const supplierRow = supplier.rows[0] ?? (existingSupplier === 'KEEP' ? (await client.query<{id:string}>(
      "SELECT id FROM srm.suppliers WHERE organization_id=$1::uuid AND " + column + "=$2",
      [organizationId, identifier.value],
    )).rows[0] : undefined);
    if (!supplierRow) throw new Error("Accepted lookup identity conflicts with its current owner or command");
    // Ordinary lookups retain their new identity. A bound accepted request may
    // retry only the identical existing lookup under the same current RLS.
    const request = await client.query<{ id: string }>(
      "INSERT INTO srm.lookup_requests(organization_id, supplier_id, identifier_type, identifier, entity_type, id) VALUES ($1, $2, $3, $4, $5, coalesce($6::uuid,gen_random_uuid())) " +
      (acceptedRequestId === undefined ? "" : "ON CONFLICT (organization_id, id) DO NOTHING ") + "RETURNING id",
      [organizationId, supplierRow.id, identifier.type, identifier.value, entityType, acceptedRequestId ?? null],
    );
    const existing = request.rows[0] ?? (acceptedRequestId === undefined ? undefined : (await client.query<{id:string}>(
      "SELECT id FROM srm.lookup_requests WHERE id=$1::uuid AND organization_id=$2::uuid AND supplier_id=$3::uuid AND identifier_type=$4 AND identifier=$5 AND entity_type=$6",
      [acceptedRequestId,organizationId,supplierRow.id,identifier.type,identifier.value,entityType],
    )).rows[0]);
    if (!existing) throw new Error("Accepted lookup identity conflicts with its current owner or command");
    return { supplierId: supplierRow.id, requestId: existing.id };
  }, pool);
}

export async function startAttempt(organizationId: string, requestId: string, section: PersistedSection, attemptNo = 1,
  retrievalMethod: "PROVIDER" | "CACHE" = "PROVIDER", pool?: DatabasePool, generalProvider?: "KRS"): Promise<string> {
  if (generalProvider !== undefined && (generalProvider !== "KRS" || section !== "general")) throw new TypeError("KRS is a General-only provider");
  const provider = generalProvider ?? (section === "kys" ? "VERCLY" : section === "jdg" ? "CEIDG" : "MGBI");
  return withOrganization(organizationId, async (client) => {
    const result = await client.query<{ id: string }>(
      "INSERT INTO srm.provider_attempts(organization_id, request_id, section, provider, attempt_no, status, retrieval_method) VALUES ($1, $2, $3, $4, $5, 'PENDING', $6) RETURNING id",
      [organizationId, requestId, section, provider, attemptNo, retrievalMethod],
    );
    return result.rows[0].id;
  }, pool);
}

export async function finishAttempt(
  organizationId: string,
  attemptId: string,
  status: TerminalStatus,
  details: { correlationId?: string; providerRecordId?: string; errorCode?: string } = {},
  pool?: DatabasePool,
): Promise<void> {
  await withOrganization(organizationId, async (client) => {
    const result = await client.query(
      "UPDATE srm.provider_attempts SET status = $3, completed_at = now(), correlation_id = $4, " +
      "provider_record_id = $5, error_code = $6 WHERE organization_id = $1 AND id = $2 AND status = 'PENDING'",
      [organizationId, attemptId, status, details.correlationId ?? null, details.providerRecordId ?? null, details.errorCode ?? null],
    );
    if (result.rowCount !== 1) throw new Error("Attempt missing, foreign or already completed");
  }, pool);
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

export async function appendSnapshot(organizationId: string, input: SnapshotInput, pool?: DatabasePool): Promise<string> {
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
  }, pool);
}

export async function purgeExpiredKysPersonal(organizationId: string, pool?: DatabasePool): Promise<void> {
  await withOrganization(organizationId, async (client) => {
    const expired = "SELECT id FROM srm.source_snapshots WHERE organization_id = $1 AND data_class = 'KYS_PERSONAL' AND retention_until < now()";
    await client.query(`DELETE FROM srm.section_projections WHERE organization_id = $1 AND snapshot_id IN (${expired})`, [organizationId]);
    await client.query(`DELETE FROM srm.source_snapshots WHERE organization_id = $1 AND data_class = 'KYS_PERSONAL' AND retention_until < now()`, [organizationId]);
  }, pool);
}

export async function readKysPersonPesel(
  organizationId: string, snapshotId: string, list: "relatedPersons" | "beneficialOwners", index: number, pool?: DatabasePool,
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
  }, pool);
}

export async function appendSectionProjection(
  organizationId: string,
  input: { supplierId: string; snapshotId: string; section: PersistedSection; data: unknown; version: number; privateEnvelope?: unknown },
  pool?: DatabasePool,
): Promise<string> {
  const serialized = JSON.stringify(input.data);
  if (!serialized || !Number.isSafeInteger(input.version) || input.version < 1) throw new Error("A valid projection is required");
  let privateEnvelope: string | undefined;
  if (input.privateEnvelope !== undefined) {
    if (!pool || !["kys", "jdg"].includes(input.section)) throw new Error("Explicit sensitive projection transaction required");
    privateEnvelope = JSON.stringify(input.privateEnvelope);
    if (!privateEnvelope || Buffer.byteLength(privateEnvelope) > 32 * 1024 * 1024) throw new Error("Bounded sensitive envelope required");
    const envelope = JSON.parse(privateEnvelope);
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)
      || Object.keys(envelope).some(k => !["status", "source", "retrievedAt", "effectiveAt", "warnings", "data"].includes(k))
      || !["SUCCESS", "PARTIAL", "ERROR", "EMPTY", "PENDING"].includes(envelope.status)
      || !Array.isArray(envelope.warnings) || envelope.warnings.some((v: unknown) => typeof v !== "string")
      || envelope.source?.provider !== (input.section === "kys" ? "VERCLY" : "CEIDG")
      || typeof envelope.retrievedAt !== "string" || !Number.isFinite(Date.parse(envelope.retrievedAt))
      || operationPayloadDigest(envelope.data as Json) !== operationPayloadDigest(input.data as Json))
      throw new Error("Sensitive projection envelope mismatch");
  }
  return withOrganization(organizationId, async (client) => {
    const result = await client.query<{ id: string }>(
      `INSERT INTO srm.section_projections(organization_id, supplier_id, snapshot_id, section, projection_version, data_json${privateEnvelope === undefined ? "" : ", private_envelope"}) ` +
      `VALUES ($1,$2,$3,$4,$5,$6::jsonb${privateEnvelope === undefined ? "" : ",$7::jsonb"}) RETURNING id`,
      [organizationId, input.supplierId, input.snapshotId, input.section, input.version, serialized,
        ...(privateEnvelope === undefined ? [] : [privateEnvelope])],
    );
    return result.rows[0].id;
  }, pool);
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

export async function appendFinancialFacts(organizationId: string, facts: FinancialFactInput[], pool?: DatabasePool): Promise<void> {
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
    await measureSupplierStage('FINANCIAL_FACTS_INSERT',()=>client.query(
      "INSERT INTO srm.financial_facts(organization_id, supplier_id, snapshot_id, metric_code, " +
      "period_start, period_end, period_type, statement_scope, amount, source_amount, normalization_rule, currency_code, unit_code, source_path, validation_status) " +
      "SELECT $1, $2, $3, f.metric_code, f.period_start, f.period_end, f.period_type, f.statement_scope, " +
      "f.amount, f.source_amount, f.normalization_rule, f.currency_code, f.unit_code, f.source_path, f.validation_status " +
      "FROM jsonb_to_recordset($4::jsonb) AS f(metric_code text, period_start date, period_end date, " +
      "period_type text, statement_scope text, amount numeric, source_amount numeric, normalization_rule text, currency_code text, unit_code text, " +
      "source_path text, validation_status text)",
      [organizationId, supplierId, snapshotId, JSON.stringify(rows)],
    ));
  }, pool);
}
