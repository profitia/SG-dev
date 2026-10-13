import { createHash, randomUUID } from "node:crypto";
import type { GeneralCompanyData, JdgField, JdgRegistryData, SupplierWebIdentityData } from "@profitia/srm-xray";
import { withOrganization, type DatabasePool } from "./db";
import { mapMgbiGeneralRecord } from "./mgbi-general";
import { normalizedWebsite, type WebSubject } from "./website-discovery";

export type EntityType = "COMPANY" | "JDG";
export type Claim = { kind: "CACHED"; data: SupplierWebIdentityData } | { kind: "PENDING" } | { kind: "CLAIMED"; token: string };
export function subjectHash(subject: WebSubject): string { return createHash("sha256").update(JSON.stringify(subject)).digest("hex"); }

function jdgWebsite(fields: readonly JdgField[]): string | null {
  for (const field of fields) {
    if (/^(?:www|website|adresStronyInternetowej|stronaInternetowa)$/i.test(field.key) && normalizedWebsite(field.value)) return normalizedWebsite(field.value);
    const nested = jdgWebsite(field.children ?? []); if (nested) return nested;
  }
  return null;
}
/** Only already selected suppliers and tenant-owned source archives can enrich a report. */
export async function readWebSubject(organizationId: string, nip: string, entityType: EntityType, pool?: DatabasePool): Promise<WebSubject | null> {
  return withOrganization(organizationId, async client => {
    if (entityType === "JDG") {
      const rows = await client.query<{ data_json: JdgRegistryData }>(
        `SELECT p.data_json FROM srm.section_projections p
         JOIN srm.suppliers s ON s.organization_id=p.organization_id AND s.id=p.supplier_id
         JOIN srm.source_snapshots snapshot ON snapshot.organization_id=p.organization_id AND snapshot.id=p.snapshot_id
         WHERE p.organization_id=$1 AND s.nip=$2 AND p.section='jdg'
           AND snapshot.retention_until > now()
         ORDER BY snapshot.retrieved_at DESC LIMIT 1`, [organizationId, nip]);
      const entry = rows.rows[0]?.data_json.entries?.find(row => row.nip === nip);
      return entry ? { nip, name: entry.name, krs: null, registryWebsite: jdgWebsite(entry.fields) } : null;
    }
    const rows = await client.query<{ general_json: { data?: GeneralCompanyData }; payload_json: { pages?: { results?: unknown[] }[] } | null }>(
      `SELECT c.general_json, a.payload_json FROM srm.catalog_companies c
       JOIN srm.organization_supplier_interest i ON i.nip=c.nip AND i.organization_id=$1
       LEFT JOIN srm.mgbi_source_archives a ON a.organization_id=$1 AND a.nip=c.nip AND a.model='pl-krs-wp-record'
       WHERE c.nip=$2`, [organizationId, nip]);
    const row = rows.rows[0], general = row?.general_json?.data;
    if (!general?.legalName || general.nip !== nip || general.registrationStatus === "DEREGISTERED") return null;
    let website = normalizedWebsite(general.website);
    if (!website) {
      for (const page of row.payload_json?.pages ?? []) for (const record of page.results ?? []) {
        const mapped = mapMgbiGeneralRecord(record, new Date().toISOString()).section.data;
        if (mapped?.nip === nip && mapped.krs === general.krs) website ??= normalizedWebsite(mapped.website);
      }
    }
    return { nip, name: general.legalName, krs: general.krs, registryWebsite: website };
  }, pool);
}
export async function claimWebIdentity(organizationId: string, nip: string, entityType: EntityType, hash: string, pool?: DatabasePool): Promise<Claim> {
  return withOrganization(organizationId, async client => {
    const token = randomUUID();
    const claimed = await client.query(
      `INSERT INTO srm.supplier_web_identity(organization_id,nip,entity_type,identity_hash,lease_token,lease_until)
       VALUES($1,$2,$3,$4,$5,now()+interval '60 seconds')
       ON CONFLICT(organization_id,nip,entity_type) DO UPDATE SET
         identity_hash=EXCLUDED.identity_hash, lease_token=EXCLUDED.lease_token, lease_until=EXCLUDED.lease_until,
         result_json=CASE WHEN srm.supplier_web_identity.identity_hash<>EXCLUDED.identity_hash THEN NULL ELSE srm.supplier_web_identity.result_json END
       WHERE (srm.supplier_web_identity.identity_hash<>EXCLUDED.identity_hash OR srm.supplier_web_identity.expires_at<=now())
         AND (srm.supplier_web_identity.identity_hash<>EXCLUDED.identity_hash OR srm.supplier_web_identity.lease_until IS NULL OR srm.supplier_web_identity.lease_until<=now())
       RETURNING nip`, [organizationId,nip,entityType,hash,token]);
    if (claimed.rowCount) return { kind: "CLAIMED", token };
    const cached = await client.query<{ result_json: SupplierWebIdentityData }>(
      `SELECT result_json FROM srm.supplier_web_identity WHERE organization_id=$1 AND nip=$2 AND entity_type=$3
       AND identity_hash=$4 AND expires_at>now() AND result_json IS NOT NULL`, [organizationId,nip,entityType,hash]);
    return cached.rows[0] ? { kind: "CACHED", data: cached.rows[0].result_json } : { kind: "PENDING" };
  }, pool);
}
export async function saveWebIdentity(organizationId: string, nip: string, entityType: EntityType, hash: string, token: string, data: SupplierWebIdentityData, pool?: DatabasePool): Promise<void> {
  const ttlSeconds = data.status === "FOUND" ? (data.logoDataUrl ? 7*86400 : 86400) : data.status === "NOT_FOUND" ? 86400 : 300;
  await withOrganization(organizationId, client => client.query(
    `UPDATE srm.supplier_web_identity SET result_json=$6::jsonb, checked_at=now(), expires_at=now()+($7 * interval '1 second'),
     lease_token=NULL,lease_until=NULL WHERE organization_id=$1 AND nip=$2 AND entity_type=$3 AND identity_hash=$4 AND lease_token=$5`,
    [organizationId,nip,entityType,hash,token,JSON.stringify(data),ttlSeconds]), pool);
}
