import { createHmac, timingSafeEqual } from "node:crypto";
import type { KysPdfSelection, VerclyKysData } from "@profitia/srm-xray";
import { withOrganization, type DatabasePool } from "./db";
import { isFreshKys, kysCacheTtlMs } from "./kys-cache";

export type KysPdfBinding = { snapshotId?: string | null; projectionVersion?: number | null; projectionHash?: string | null;
  dataClass?: string | null; retrievedAt: string | Date | null; retentionUntil: string | Date | null };
export type StoredKysPdf = KysPdfBinding & { attemptStatus: string; data: VerclyKysData | null; warnings: string[]; completionConfirmed: boolean };
type Selection = Pick<KysPdfSelection, "nip" | "entityType">;
const iso = (v: string | Date | null) => v && Number.isFinite(new Date(v).getTime()) ? new Date(v).toISOString() : null;
export function kysExportRef(organizationId: string, selection: Selection, row: KysPdfBinding, secret: string | undefined): string | null {
  if (!secret || secret.length < 32 || !row.snapshotId || !row.projectionVersion || !row.projectionHash ||
    !["KYS_PERSONAL", "KYS_REDACTED"].includes(row.dataClass ?? "") || !iso(row.retrievedAt) || !iso(row.retentionUntil)) return null;
  return createHmac("sha256", secret).update(JSON.stringify(["srm-kys-pdf-v1", organizationId, selection.nip, selection.entityType,
    row.snapshotId, row.projectionVersion, row.projectionHash, row.dataClass, iso(row.retrievedAt), iso(row.retentionUntil)])).digest("hex");
}
export class KysPdfError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function authorizeStoredKys(row: StoredKysPdf | null, organizationId: string, selection: KysPdfSelection,
  now: Date, env: Readonly<Record<string, string | undefined>>): { row: StoredKysPdf & { data: VerclyKysData }; expiresAt: string } {
  if (!row?.data || !["SUCCESS", "PARTIAL"].includes(row.attemptStatus) || !Array.isArray(row.data.pepMatches))
    throw new KysPdfError(404, "Brak zapisanego raportu dostępnego do eksportu.");
  if (!isFreshKys(row.retrievedAt, row.retentionUntil, now, kysCacheTtlMs(env)))
    throw new KysPdfError(410, "Raport KYS stracił ważność. Nowe pobranie wymaga osobnego działania.");
  const expected = kysExportRef(organizationId, selection, row, env.SRM_DEMO_SESSION_SECRET);
  if (!expected || selection.retrievedAt !== iso(row.retrievedAt) || !/^[a-f0-9]{64}$/.test(selection.exportRef) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(selection.exportRef)))
    throw new KysPdfError(409, "Wersja raportu zmieniła się lub nie została potwierdzona. Wyświetl właściwy raport przed eksportem.");
  if (row.data.company?.nip && row.data.company.nip !== selection.nip)
    throw new KysPdfError(409, "Nie można potwierdzić zgodności raportu z dostawcą.");
  return { row: row as StoredKysPdf & { data: VerclyKysData }, expiresAt: new Date(Math.min(new Date(row.retentionUntil!).getTime(),
    new Date(row.retrievedAt!).getTime() + kysCacheTtlMs(env))).toISOString() };
}

/** Latest organization-scoped attempt only. No global fallback, provider, purge, lease or write. */
export const KYS_PDF_SQL = `SELECT a.status AS "attemptStatus", s.id::text AS "snapshotId", s.data_class AS "dataClass",
  s.retrieved_at AS "retrievedAt", s.retention_until AS "retentionUntil", p.projection_version AS "projectionVersion",
  md5(p.data_json::text || COALESCE((k.report_json->'warnings')::text, '[]')) AS "projectionHash", p.data_json AS data,
  COALESCE(k.report_json->'warnings', '[]'::jsonb) AS warnings, COALESCE(k.report_json->>'status' = 'SUCCESS', false) AS "completionConfirmed"
  FROM srm.lookup_requests l
  JOIN srm.provider_attempts a ON a.organization_id=l.organization_id AND a.request_id=l.id AND a.section='kys'
  LEFT JOIN srm.source_snapshots s ON s.organization_id=a.organization_id AND s.attempt_id=a.id AND s.supplier_id=l.supplier_id AND s.section='kys'
  LEFT JOIN srm.section_projections p ON p.organization_id=s.organization_id AND p.snapshot_id=s.id AND p.supplier_id=s.supplier_id AND p.section='kys'
  LEFT JOIN srm.catalog_kys_reports k ON k.nip=l.identifier AND k.entity_type=l.entity_type AND k.report_json->'data'=p.data_json
  WHERE l.organization_id=$1::uuid AND l.identifier_type='NIP' AND l.identifier=$2 AND l.entity_type=$3
  ORDER BY l.requested_at DESC, a.started_at DESC, p.projection_version DESC LIMIT 1`;
export async function readStoredKysPdf(organizationId: string, selection: Selection, pool?: DatabasePool): Promise<StoredKysPdf | null> {
  return withOrganization(organizationId, async client => (await client.query<StoredKysPdf>(KYS_PDF_SQL,
    [organizationId, selection.nip, selection.entityType])).rows[0] ?? null, pool);
}
