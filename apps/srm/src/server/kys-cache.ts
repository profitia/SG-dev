import { createHash, randomUUID } from "node:crypto";
import type { SectionEnvelope, VerclyKysData } from "@profitia/srm-xray";
import { withOrganization } from "./db";

export type KysEntityType = "COMPANY" | "JDG";
export type KysSection = SectionEnvelope<VerclyKysData>;
export interface KysCacheStore {
  read(organizationId: string, nip: string, entityType: KysEntityType, now: Date): Promise<KysSection | null>;
  claim(organizationId: string, nip: string, entityType: KysEntityType, now: Date): Promise<string | null>;
  save(organizationId: string, nip: string, entityType: KysEntityType, owner: string, section: KysSection, snapshotId: string | null): Promise<void>;
  release(organizationId: string, nip: string, entityType: KysEntityType, owner: string): Promise<void>;
}
export const MAX_KYS_CACHE_TTL_HOURS = 168;
const HOUR_MS = 60 * 60 * 1000;
const LEASE_MS = 190_000;

/** Shortening this setting immediately makes older cached results ineligible. */
export function kysCacheTtlMs(env: Readonly<Record<string, string | undefined>> = process.env): number {
  const raw = env.SRM_KYS_CACHE_TTL_HOURS;
  if (raw === undefined || raw === "") return MAX_KYS_CACHE_TTL_HOURS * HOUR_MS;
  const hours = Number(raw);
  if (!Number.isInteger(hours) || hours < 1 || hours > MAX_KYS_CACHE_TTL_HOURS) {
    throw new Error("SRM_KYS_CACHE_TTL_HOURS must be an integer from 1 to 168");
  }
  return hours * HOUR_MS;
}

export function kysExpiry(retrievedAt: string | Date, ttlMs = kysCacheTtlMs()): Date {
  const start = new Date(retrievedAt).getTime();
  if (!Number.isFinite(start)) throw new Error("KYS retrieval time is invalid");
  return new Date(start + ttlMs);
}

export function isFreshKys(retrievedAt: string | Date | null, retentionUntil: string | Date | null,
  now = new Date(), ttlMs = kysCacheTtlMs()): boolean {
  if (!retrievedAt || !retentionUntil) return false;
  const start = new Date(retrievedAt).getTime();
  const end = Math.min(new Date(retentionUntil).getTime(), start + ttlMs);
  return Number.isFinite(start) && Number.isFinite(end) && start <= now.getTime() && now.getTime() < end;
}

type CacheRow = { report_json: KysSection | null; retrieved_at: Date | null; retention_until: Date | null };

export async function readFreshKys(organizationId: string, nip: string, entityType: KysEntityType,
  now = new Date()): Promise<KysSection | null> {
  return withOrganization(organizationId, async (client) => {
    const result = await client.query<CacheRow>(
      "SELECT report_json, retrieved_at, retention_until FROM srm.catalog_kys_reports WHERE nip = $1 AND entity_type = $2",
      [nip, entityType],
    );
    const row = result.rows[0];
    if (!row?.report_json?.data || !isFreshKys(row.retrieved_at, row.retention_until, now)) return null;
    if (row.report_json.status !== "SUCCESS") return null;
    return row.report_json;
  });
}

export async function claimKysRefresh(organizationId: string, nip: string, entityType: KysEntityType,
  now = new Date()): Promise<string | null> {
  const owner = randomUUID();
  return withOrganization(organizationId, async (client) => {
    const result = await client.query<{ lease_owner: string }>(
      `INSERT INTO srm.catalog_kys_reports(nip, entity_type, lease_owner, lease_until)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (nip, entity_type) DO UPDATE SET
         lease_owner = EXCLUDED.lease_owner, lease_until = EXCLUDED.lease_until,
         report_json = NULL, report_sha256 = NULL, retrieved_at = NULL, retention_until = NULL,
         source_organization_id = NULL, source_snapshot_id = NULL, updated_at = now()
       WHERE (srm.catalog_kys_reports.lease_until IS NULL OR srm.catalog_kys_reports.lease_until <= $5)
         AND (srm.catalog_kys_reports.report_json IS NULL
           OR srm.catalog_kys_reports.retention_until <= $5
           OR srm.catalog_kys_reports.retrieved_at + ($6::bigint * interval '1 millisecond') <= $5)
       RETURNING lease_owner`,
      [nip, entityType, owner, new Date(now.getTime() + LEASE_MS), now, kysCacheTtlMs()],
    );
    return result.rows[0]?.lease_owner ?? null;
  });
}

export async function saveKysRefresh(organizationId: string, nip: string, entityType: KysEntityType,
  leaseOwner: string, section: KysSection, snapshotId: string | null): Promise<void> {
  if (section.status !== "SUCCESS" || !section.data || !section.retrievedAt) {
    throw new Error("Only complete KYS reports may be cached");
  }
  const expiry = kysExpiry(section.retrievedAt);
  const json = JSON.stringify(section);
  const digest = createHash("sha256").update(json).digest("hex");
  await withOrganization(organizationId, async (client) => {
    const result = await client.query(
      `UPDATE srm.catalog_kys_reports SET report_json = $5::jsonb, report_sha256 = $6,
       retrieved_at = $7, retention_until = $8, source_organization_id = $9,
       source_snapshot_id = $10, lease_owner = NULL, lease_until = NULL, updated_at = now()
       WHERE nip = $1 AND entity_type = $2 AND lease_owner = $3 AND lease_until > $4`,
      [nip, entityType, leaseOwner, new Date(), json, digest, new Date(section.retrievedAt!), expiry, organizationId, snapshotId],
    );
    if (result.rowCount !== 1) throw new Error("KYS cache refresh lease expired");
  });
}

export async function releaseKysRefresh(organizationId: string, nip: string, entityType: KysEntityType,
  leaseOwner: string): Promise<void> {
  await withOrganization(organizationId, async (client) => {
    await client.query("UPDATE srm.catalog_kys_reports SET lease_owner = NULL, lease_until = NULL WHERE nip = $1 AND entity_type = $2 AND lease_owner = $3",
      [nip, entityType, leaseOwner]);
  });
}

/** Remove expired personal reports on every KYS request, including reports for other NIPs. */
export async function purgeExpiredSharedKys(organizationId: string, now = new Date()): Promise<void> {
  await withOrganization(organizationId, async (client) => {
    await client.query(
      "DELETE FROM srm.catalog_kys_reports WHERE report_json IS NOT NULL AND (retention_until <= $1 OR retrieved_at + ($2::bigint * interval '1 millisecond') <= $1) AND (lease_until IS NULL OR lease_until <= $1)",
      [now, kysCacheTtlMs()],
    );
  });
}

export async function getOrFetchKys(organizationId: string, nip: string, entityType: KysEntityType,
  fetchReport: () => Promise<{ section: KysSection; errorCode: string | null; correlationId: string | null }>,
  persist: (section: KysSection, errorCode: string | null, correlationId: string | null, method: "PROVIDER" | "CACHE") => Promise<string | null>,
  options: { now?: () => Date; sleep?: (ms: number) => Promise<void>; waitMs?: number;
    store?: KysCacheStore } = {},
): Promise<{ section: KysSection; snapshotId: string | null; retrievalMethod: "PROVIDER" | "CACHE" }> {
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const store = options.store ?? kysStore;
  const waitMs = options.waitMs ?? 195_000;
  const deadline = now().getTime() + waitMs;
  while (true) {
    const hit = await store.read(organizationId, nip, entityType, now());
    if (hit) return { section: hit, snapshotId: await persist(hit, null, null, "CACHE"), retrievalMethod: "CACHE" };
    const owner = await store.claim(organizationId, nip, entityType, now());
    if (owner) {
      try {
        const result = await fetchReport();
        const snapshotId = await persist(result.section, result.errorCode, result.correlationId, "PROVIDER");
        if (result.section.status === "SUCCESS" && result.section.data) {
          await store.save(organizationId, nip, entityType, owner, result.section, snapshotId);
        } else await store.release(organizationId, nip, entityType, owner);
        return { section: result.section, snapshotId, retrievalMethod: "PROVIDER" };
      } catch (error) {
        await store.release(organizationId, nip, entityType, owner).catch(() => {});
        throw error;
      }
    }
    if (now().getTime() >= deadline) throw new Error("KYS cache refresh wait timed out");
    await sleep(1_000);
  }
}

const kysStore = { read: readFreshKys, claim: claimKysRefresh, save: saveKysRefresh, release: releaseKysRefresh };
