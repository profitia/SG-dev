import type { GeneralCompanyData, SectionEnvelope } from "@profitia/srm-xray";
import { withOrganization, type DatabasePool } from "./db";
import { mapPrimaryPkd } from "./mgbi-general";

// Only the current primary activity crosses this boundary. Never load a full
// archive/person record to enrich the public company identity.
export const COMPANY_PKD_SQL = `SELECT r.record#>'{content,current_excerpt,dane,dzial3,przedmiotDzialalnosci,przedmiotPrzewazajacejDzialalnosci}' AS activity
  FROM srm.mgbi_source_archives a
  CROSS JOIN LATERAL jsonb_array_elements(a.payload_json->'pages') page
  CROSS JOIN LATERAL jsonb_array_elements(page->'results') r(record)
  WHERE a.organization_id=$2::uuid AND a.nip=$1 AND a.model='pl-krs-wp-record'
    AND r.record#>>'{identifiers,pl_nip}'=$1
    AND r.record->>'id'=$3
  ORDER BY a.last_checked_at DESC LIMIT 1`;

export async function enrichCompanyPkd(organizationId: string, nip: string,
  general: SectionEnvelope<GeneralCompanyData>, pool?: DatabasePool): Promise<GeneralCompanyData | null> {
  const data = general.data;
  if (!data || data.mainPkdDescription || data.nip !== nip || !data.mainPkd || !general.source.recordId) return data;
  return withOrganization(organizationId, async client => {
    const row = (await client.query<{ activity: unknown }>(COMPANY_PKD_SQL, [nip, organizationId, general.source.recordId])).rows[0];
    const primary = mapPrimaryPkd(row?.activity);
    // A newer/different code must never acquire the older record's description.
    return primary.code === data.mainPkd && primary.description
      ? { ...data, mainPkdDescription: primary.description } : data;
  }, pool);
}
