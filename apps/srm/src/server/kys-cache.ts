import { createHash, randomUUID } from "node:crypto";
import type { SectionEnvelope, VerclyKysData } from "@profitia/srm-xray";
import { atLookupStage, kysMode, kysOutcome } from "./lookup-diagnostics";
import { withOrganization } from "./db";

export type KysEntityType = "COMPANY" | "JDG";
export type KysSection = SectionEnvelope<VerclyKysData>;
export interface KysCacheStore {
  read(organizationId: string, nip: string, entityType: KysEntityType, now: Date): Promise<KysSection | null>;
  claim(organizationId: string, nip: string, entityType: KysEntityType, now: Date): Promise<string | null>;
  save(organizationId: string, nip: string, entityType: KysEntityType, owner: string, section: KysSection, snapshotId: string | null): Promise<void>;
  hold(organizationId: string, nip: string, entityType: KysEntityType, owner: string): Promise<void>;
  renew(organizationId: string, nip: string, entityType: KysEntityType, owner: string, now: Date): Promise<boolean>;
  release(organizationId: string, nip: string, entityType: KysEntityType, owner: string): Promise<void>;
}
export const MAX_KYS_CACHE_TTL_HOURS = 168;
const HOUR_MS = 60 * 60 * 1000;
export const KYS_LEASE_MS = 260_000;
export const KYS_FINALIZATION_BUDGET_MS = 60_000;
export const KYS_FOLLOWER_BUDGET_MS = 270_000;

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

export function hasCurrentKysProjection(section: KysSection | null): boolean {
  return Array.isArray(section?.data?.pepMatches);
}

export async function readFreshKys(organizationId: string, nip: string, entityType: KysEntityType,
  now = new Date()): Promise<KysSection | null> {
  return withOrganization(organizationId, async (client) => {
    const result = await client.query<CacheRow>(
      "SELECT report_json, retrieved_at, retention_until FROM srm.catalog_kys_reports WHERE nip = $1 AND entity_type = $2",
      [nip, entityType],
    );
    const row = result.rows[0];
    const section = row?.report_json;
    if (!section || !hasCurrentKysProjection(section) || !isFreshKys(row.retrieved_at, row.retention_until, now)) return null;
    if (section.status !== "SUCCESS") return null;
    return section;
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
         updated_at = now()
       WHERE (srm.catalog_kys_reports.lease_until IS NULL OR srm.catalog_kys_reports.lease_until <= $5)
         AND (srm.catalog_kys_reports.report_json IS NULL
           OR srm.catalog_kys_reports.retention_until <= $5
           OR srm.catalog_kys_reports.retrieved_at + ($6::bigint * interval '1 millisecond') <= $5
           OR jsonb_typeof(srm.catalog_kys_reports.report_json #> '{data,pepMatches}') IS DISTINCT FROM 'array')
       RETURNING lease_owner`,
      [nip, entityType, owner, new Date(now.getTime() + KYS_LEASE_MS), now, kysCacheTtlMs()],
    );
    return result.rows[0]?.lease_owner ?? null;
  });
}

export async function saveKysRefresh(organizationId: string, nip: string, entityType: KysEntityType,
  leaseOwner: string, section: KysSection, snapshotId: string | null): Promise<void> {
  if (section.status !== "SUCCESS" || !hasCurrentKysProjection(section) || !section.retrievedAt) {
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
      "UPDATE srm.catalog_kys_reports SET report_json = NULL, report_sha256 = NULL WHERE report_json IS NOT NULL AND (retention_until <= $1 OR retrieved_at + ($2::bigint * interval '1 millisecond') <= $1)",
      [now, kysCacheTtlMs()],
    );
  });
}

/** An ambiguous paid POST requires explicit reconciliation; lease expiry must not silently order again. */
export async function holdKysRefresh(organizationId: string, nip: string, entityType: KysEntityType, owner: string): Promise<void> {
  await withOrganization(organizationId, async (client) => { await client.query("UPDATE srm.catalog_kys_reports SET lease_until = 'infinity'::timestamptz WHERE nip=$1 AND entity_type=$2 AND lease_owner=$3", [nip, entityType, owner]); });
}

export async function renewKysRefresh(organizationId: string, nip: string, entityType: KysEntityType, owner: string, now: Date): Promise<boolean> {
  return withOrganization(organizationId, async (client) => {
    const result = await client.query("UPDATE srm.catalog_kys_reports SET lease_until = $5 WHERE nip = $1 AND entity_type = $2 AND lease_owner = $3 AND lease_until > $4", [nip, entityType, owner, now, new Date(now.getTime() + KYS_LEASE_MS)]);
    return result.rowCount === 1;
  });
}

export async function getOrFetchKys(organizationId: string, nip: string, entityType: KysEntityType,
  fetchReport: () => Promise<{ section: KysSection; errorCode: string | null; correlationId: string | null; providerOrderAccepted?: boolean }>,
  persist: (section: KysSection, errorCode: string | null, correlationId: string | null, method: "PROVIDER" | "CACHE") => Promise<string | null>,
  options: { now?: () => Date; sleep?: (ms: number) => Promise<void>; waitMs?: number; elapsedNow?: () => number; signal?: AbortSignal; store?: KysCacheStore } = {},
): Promise<{ section: KysSection; snapshotId: string | null; retrievalMethod: "PROVIDER" | "CACHE" }> {
  const now = options.now ?? (() => new Date());
  const clock = options.elapsedNow ?? (() => performance.now());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const store = options.store ?? kysStore;
  const finalize = async (section: KysSection, errorCode: string | null, correlationId: string | null, method: "PROVIDER" | "CACHE", budget = KYS_FINALIZATION_BUDGET_MS) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await atLookupStage("tenant_persistence", () => Promise.race([
      persist(section, errorCode, correlationId, method),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { kysOutcome("ERROR", "TIMEOUT"); reject(new Error("KYS finalization timed out")); }, Math.max(1, budget)); }),
    ]), "kys"); } finally { if (timer) clearTimeout(timer); }
  };
  const deadline = clock() + (options.waitMs ?? KYS_FOLLOWER_BUDGET_MS);
  options.signal?.throwIfAborted();
  const hit = await atLookupStage("cache_read", () => store.read(organizationId, nip, entityType, now()), "kys");
  if (hit) {
    kysMode("CACHE"); kysOutcome(hit.status);
    return { section: hit, snapshotId: await finalize(hit, null, null, "CACHE"), retrievalMethod: "CACHE" };
  }
  const owner = await atLookupStage("lease_acquisition", () => store.claim(organizationId, nip, entityType, now()), "kys");
  if (owner) {
    kysMode("PROVIDER"); let ambiguous = true;
    try {
      const result = await fetchReport();
      ambiguous = result.providerOrderAccepted === true && result.section.status !== "SUCCESS" || Boolean(result.errorCode && ["VERCLY_POST_OUTCOME_UNKNOWN", "VERCLY_ABORTED", "VERCLY_TIMEOUT", "VERCLY_NETWORK_ERROR"].includes(result.errorCode));
      kysOutcome(result.section.status, result.errorCode);
      // Verify ownership before tenant persistence. Expired owners never publish a new projection.
      if (!await atLookupStage("lease_acquisition", () => store.renew(organizationId, nip, entityType, owner, now()), "kys")) throw new Error("KYS cache refresh lease expired");
      let finalizationTimer: ReturnType<typeof setTimeout> | undefined;
      let snapshotId: string | null;
      try {
        snapshotId = await Promise.race([
          (async () => {
            // Publish the complete shared report while ownership is valid, before tenant finalization.
            // A tenant persistence failure cannot cause another paid provider order.
            if (result.section.status === "SUCCESS" && result.section.data) await atLookupStage("cache_persistence", () => store.save(organizationId, nip, entityType, owner, result.section, null), "kys");
            else if (ambiguous) await store.hold(organizationId, nip, entityType, owner);
            return finalize(result.section, result.errorCode, result.correlationId, "PROVIDER");
          })(),
          new Promise<never>((_, reject) => { finalizationTimer = setTimeout(() => { kysOutcome("ERROR", "TIMEOUT"); reject(new Error("KYS finalization timed out")); }, KYS_FINALIZATION_BUDGET_MS); }),
        ]);
      } finally { if (finalizationTimer) clearTimeout(finalizationTimer); }
      if (result.section.status !== "SUCCESS" && !ambiguous) await store.release(organizationId, nip, entityType, owner);
      return { section: result.section, snapshotId, retrievalMethod: "PROVIDER" };
    } catch (error) {
      kysOutcome("ERROR", error instanceof Error && error.message.includes("timed out") ? "TIMEOUT" : null);
      if (ambiguous) await store.hold(organizationId, nip, entityType, owner).catch(() => {});
      else await store.release(organizationId, nip, entityType, owner).catch(() => {});
      throw error;
    }
  }
  kysMode("FOLLOWER");
  // A follower observes the existing flight; it cannot turn a failed/ambiguous flight into another POST.
  while (clock() < deadline) {
    options.signal?.throwIfAborted();
    const section = await atLookupStage("cache_read", () => store.read(organizationId, nip, entityType, now()), "kys");
    if (section) {
      kysOutcome(section.status);
      return { section, snapshotId: await finalize(section, null, null, "CACHE", Math.min(KYS_FINALIZATION_BUDGET_MS, deadline - clock())), retrievalMethod: "CACHE" };
    }
    await sleep(Math.min(2_000, Math.max(0, deadline - clock())));
  }
  kysOutcome("ERROR", "TIMEOUT");
  throw new Error("KYS cache refresh wait timed out");
}
const kysStore = { read: readFreshKys, claim: claimKysRefresh, save: saveKysRefresh, release: releaseKysRefresh, renew: renewKysRefresh, hold: holdKysRefresh };
