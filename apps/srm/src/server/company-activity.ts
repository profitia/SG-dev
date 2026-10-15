import { jdgDeregistration } from "@profitia/srm-xray";
import { withOrganization, type DatabasePool } from "./db";
import type { GeneralCompanyData } from "@profitia/srm-xray";

type Status = NonNullable<GeneralCompanyData["registrationStatus"]>;
const object = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

/** Latest exact removal entry, absent current excerpt and full-register state
 * must agree. Missing names, financial documents and MSR flags are not evidence. */
export function companyRegistration(record: unknown): { status: Status; deregisteredAt: string | null } {
  const content = object(object(record)?.content), current = object(content?.current_excerpt);
  const header = object(object(content?.full_excerpt)?.naglowekP), entries = header?.wpis;
  const result = (status: Status, deregisteredAt: string | null = null) => ({status,deregisteredAt});
  const liquidation = object(object(current?.dane)?.dzial6)?.likwidacja;
  const entriesInLiquidation = Array.isArray(liquidation) ? liquidation : liquidation ? [liquidation] : [];
  // Current KRS section 6, not a company-name substring or an old full-excerpt entry.
  const inLiquidation = entriesInLiquidation.some(value => {
    const entry = object(value), opening = entry?.otwarcieLikwidacji;
    return typeof opening === "string" && !!opening.trim() && !/^(brak|nie dotyczy)$/i.test(opening.trim())
      && !entry?.zakonczenieLikwidacji && !entry?.uchylenieLikwidacji;
  });
  const currentStatus = inLiquidation ? "LIQUIDATION" : "ACTIVE";
  if (!Array.isArray(entries) || !entries.length || entries.length > 10_000) return result(current ? currentStatus : "UNKNOWN");
  const parsed = entries.map(value => {
    const entry = object(value), raw = entry?.numerWpisu;
    const n = typeof raw === "number" && Number.isSafeInteger(raw) ? String(raw) : raw;
    return entry && typeof n === "string" && /^[1-9][0-9]{0,8}$/.test(n) ? {entry, number:Number(n)} : null;
  });
  if (parsed.some(value => !value) || new Set(parsed.map(value => value!.number)).size !== parsed.length) return result("UNKNOWN");
  const latest = parsed.reduce((a,b) => a!.number > b!.number ? a : b)!;
  const description = typeof latest.entry.opis === "string" ? latest.entry.opis.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().replace(/\s+/g," ").toUpperCase() : "";
  if (description !== "WYKRESLENIE Z KRAJOWEGO REJESTRU SADOWEGO") return result(current ? currentStatus : "UNKNOWN");
  if (current || String(header?.stanPozycji) !== "2") return result("UNKNOWN");
  const match = typeof latest.entry.dataWpisu === "string" ? /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(latest.entry.dataWpisu) : null;
  if (!match) return result("DEREGISTERED");
  const date = new Date(Date.UTC(Number(match[3]), Number(match[2])-1, Number(match[1])));
  if (date.getUTCFullYear() !== Number(match[3]) || date.getUTCMonth()+1 !== Number(match[2]) || date.getUTCDate() !== Number(match[1])) return result("DEREGISTERED");
  if (date.getTime() > Date.now()) return result("UNKNOWN");
  return result("DEREGISTERED",date.toISOString().slice(0,10));
}
export function companyRegistrationStatus(record: unknown): Status { return companyRegistration(record).status; }

// Archive fallback is restricted to the authenticated organization and exact
// NIP/record. Only status evidence crosses the DB boundary; representative lists are excluded.
export const COMPANY_ACTIVITY_SQL = `SELECT c.general_json#>>'{data,registrationStatus}' AS status, c.general_json#>>'{data,deregisteredAt}' AS "deregisteredAt",
  (SELECT jsonb_build_object('content',jsonb_build_object(
    'current_excerpt',CASE WHEN jsonb_typeof(r.record#>'{content,current_excerpt}')='object' THEN jsonb_build_object('dane',jsonb_build_object('dzial6',jsonb_build_object('likwidacja',
      (SELECT jsonb_agg(jsonb_build_object('otwarcieLikwidacji',l->'otwarcieLikwidacji',
        'zakonczenieLikwidacji',l->'zakonczenieLikwidacji','uchylenieLikwidacji',l->'uchylenieLikwidacji'))
       FROM jsonb_array_elements(CASE jsonb_typeof(r.record#>'{content,current_excerpt,dane,dzial6,likwidacja}')
         WHEN 'array' THEN r.record#>'{content,current_excerpt,dane,dzial6,likwidacja}'
         WHEN 'object' THEN jsonb_build_array(r.record#>'{content,current_excerpt,dane,dzial6,likwidacja}')
         ELSE '[]'::jsonb END) l)))) ELSE 'null'::jsonb END,
    'full_excerpt',jsonb_build_object('naglowekP',r.record#>'{content,full_excerpt,naglowekP}')))
   FROM srm.mgbi_source_archives a
   CROSS JOIN LATERAL jsonb_array_elements(a.payload_json->'pages') page
   CROSS JOIN LATERAL jsonb_array_elements(page->'results') r(record)
   WHERE a.organization_id=$2::uuid AND a.nip=$1 AND a.model='pl-krs-wp-record'
     AND r.record#>>'{identifiers,pl_nip}'=$1
     AND (c.general_json#>>'{source,recordId}' IS NULL OR r.record->>'id'=c.general_json#>>'{source,recordId}')
   ORDER BY a.last_checked_at DESC LIMIT 1) AS record
  FROM (SELECT $1::text AS nip) selected LEFT JOIN srm.catalog_companies c ON c.nip=selected.nip`;

export async function readCompanyRegistration(organizationId: string, nip: string, pool?: DatabasePool): Promise<{status:Status;deregisteredAt:string|null}> {
  return withOrganization(organizationId, async client => {
    // A successor can differ from the legacy catalog selection. Resolve the
    // whole public identity inventory before withholding analytical/KYS data.
    const {readArchivedCompanyGeneral} = await import("./company-general-cache");
    const resolved = await readArchivedCompanyGeneral(client,organizationId,nip);
    if (resolved?.errorCode) throw new Error("MGBI_COMPANY_IDENTITY_UNRESOLVED");
    if (resolved?.section.data?.registryHistory) return {status:resolved.section.data.registrationStatus ?? "UNKNOWN",deregisteredAt:resolved.section.data.deregisteredAt ?? null};
    const row = (await client.query<{status?: Status; deregisteredAt?: string; record?: unknown}>(COMPANY_ACTIVITY_SQL,[nip,organizationId])).rows[0];
    const archived = companyRegistration(row?.record);
    if (row?.record) return archived;
    if (row?.status === "LIQUIDATION") return {status:"LIQUIDATION",deregisteredAt:null};
    if (row?.status === "ACTIVE") return {status:"ACTIVE",deregisteredAt:null};
    if (row?.status === "DEREGISTERED") return {status:"DEREGISTERED",deregisteredAt:row.deregisteredAt ?? archived.deregisteredAt};
    return archived;
  }, pool);
}

export async function readCompanyRegistrationStatus(organizationId: string, nip: string, pool?: DatabasePool): Promise<Status> {
  return (await readCompanyRegistration(organizationId,nip,pool)).status;
}

export const JDG_ACTIVITY_SQL = `SELECT jsonb_build_object('entries',
  (SELECT jsonb_agg(jsonb_build_object('status',e->>'status','fields',
    (SELECT coalesce(jsonb_agg(f),'[]'::jsonb) FROM jsonb_array_elements(e->'fields') f WHERE f->>'key'='dataWykreslenia')))
   FROM jsonb_array_elements(p.data_json->'entries') e)) AS data
  FROM srm.suppliers s JOIN srm.section_projections p ON p.organization_id=s.organization_id AND p.supplier_id=s.id
  JOIN srm.source_snapshots snapshot ON snapshot.organization_id=p.organization_id AND snapshot.id=p.snapshot_id
  WHERE s.organization_id=$2::uuid AND s.nip=$1 AND p.section='jdg' AND snapshot.retention_until>now()
  ORDER BY p.created_at DESC,p.projection_version DESC LIMIT 1`;
export async function readSupplierRegistrationStatus(organizationId: string, nip: string, entityType: "COMPANY" | "JDG", pool?: DatabasePool): Promise<Status> {
  if (entityType === "COMPANY") return readCompanyRegistrationStatus(organizationId,nip,pool);
  return withOrganization(organizationId,async client => {
    const row = (await client.query<{data: import("@profitia/srm-xray").JdgRegistryData}>(JDG_ACTIVITY_SQL,[nip,organizationId])).rows[0];
    return jdgDeregistration(row?.data).deregistered ? "DEREGISTERED" : "UNKNOWN";
  },pool);
}
