import type { PoolClient } from "pg";
import { mapMgbiGeneralRecord, mapMgbiGeneralRecords, type MgbiGeneralResult } from "./mgbi-general";
import {companyRegistration} from "./company-activity";

const array = (sql: string) => `CASE WHEN jsonb_typeof(${sql})='array' THEN ${sql} ELSE '[]'::jsonb END`;
function formation(prefix: string): string {
  const f = `${prefix}#>'{dane,dzial1,sposobPowstaniaPodmiotu}'`;
  return `jsonb_build_object('okolicznosciPowstania',(${f})->'okolicznosciPowstania','podmioty',
    (SELECT jsonb_agg(jsonb_build_object('krs',p->'krs','numerWRejestrzeAlboEwidencji',p->'numerWRejestrzeAlboEwidencji')) FROM jsonb_array_elements(${array(`(${f})->'podmioty'`)}) p))`;
}
const current = "r#>'{content,current_excerpt}'", full = "r#>'{content,full_excerpt}'";
/** Only public corporate identity, formation KRS links and removal evidence.
 * Directors, shareholders, personal identifiers and transformation prose stay in the archive. */
export const COMPANY_GENERAL_ARCHIVE_SQL = `SELECT a.record_count,a.last_checked_at AS retrieved_at,
  a.payload_jsonb_sha256=encode(sha256(convert_to(a.payload_json::text,'UTF8')),'hex') AS valid_checksum,
  (SELECT jsonb_agg(jsonb_build_object('id',r->'id',
    'identifiers',jsonb_build_object('pl_nip',r#>'{identifiers,pl_nip}','pl_krs',r#>'{identifiers,pl_krs}','pl_regon',r#>'{identifiers,pl_regon}'),
    'content',jsonb_build_object('current_excerpt',CASE WHEN jsonb_typeof(${current})='object' THEN jsonb_build_object(
      'naglowekA',(${current})->'naglowekA','dane',jsonb_build_object(
        'dzial1',jsonb_build_object('danePodmiotu',jsonb_build_object('nazwa',r#>'{content,current_excerpt,dane,dzial1,danePodmiotu,nazwa}',
          'formaPrawna',r#>'{content,current_excerpt,dane,dzial1,danePodmiotu,formaPrawna}'),
          'siedzibaIAdres',r#>'{content,current_excerpt,dane,dzial1,siedzibaIAdres}','sposobPowstaniaPodmiotu',${formation(`(${current})`)}),
        'dzial3',jsonb_build_object('przedmiotDzialalnosci',jsonb_build_object('przedmiotPrzewazajacejDzialalnosci',r#>'{content,current_excerpt,dane,dzial3,przedmiotDzialalnosci,przedmiotPrzewazajacejDzialalnosci}')),
        'dzial6',jsonb_build_object('likwidacja',(SELECT jsonb_agg(jsonb_build_object('otwarcieLikwidacji',l->'otwarcieLikwidacji',
          'zakonczenieLikwidacji',l->'zakonczenieLikwidacji','uchylenieLikwidacji',l->'uchylenieLikwidacji'))
          FROM jsonb_array_elements(CASE jsonb_typeof(r#>'{content,current_excerpt,dane,dzial6,likwidacja}') WHEN 'object' THEN jsonb_build_array(r#>'{content,current_excerpt,dane,dzial6,likwidacja}')
            WHEN 'array' THEN r#>'{content,current_excerpt,dane,dzial6,likwidacja}' ELSE '[]'::jsonb END) l)))) ELSE 'null'::jsonb END,
      'full_excerpt',jsonb_build_object('naglowekP',(${full})->'naglowekP','dane',jsonb_build_object('dzial1',jsonb_build_object(
        'danePodmiotu',jsonb_build_object('nazwa',r#>'{content,full_excerpt,dane,dzial1,danePodmiotu,nazwa}','formaPrawna',r#>'{content,full_excerpt,dane,dzial1,danePodmiotu,formaPrawna}'),
        'sposobPowstaniaPodmiotu',${formation(`(${full})`)}))))))
   FROM jsonb_array_elements(a.payload_json->'pages') page CROSS JOIN LATERAL jsonb_array_elements(page->'results') r) AS records
  FROM srm.mgbi_source_archives a WHERE a.nip=$1 AND a.organization_id=$2::uuid AND a.model='pl-krs-wp-record'`;

type Archive = {record_count:number;retrieved_at:Date|string;valid_checksum:boolean;records:unknown[]};
export function projectCompanyGeneralArchive(row: Archive, nip: string): MgbiGeneralResult {
  if (!row.valid_checksum || !Number.isSafeInteger(row.record_count) || row.record_count < 1 || row.record_count > 100
      || !Array.isArray(row.records) || row.records.length !== row.record_count
      || row.records.some(r => (r as {identifiers?:{pl_nip?:string}})?.identifiers?.pl_nip !== nip))
    throw new Error("Company identity archive integrity mismatch");
  const retrievedAt=new Date(row.retrieved_at).toISOString();
  // Historical imports may contain only the NIP and exact removal proof. They
  // may continue withholding a report, but cannot assert a current KRS or admit finances.
  if(row.records.length===1 && !(row.records[0] as {identifiers?:{pl_krs?:unknown}}).identifiers?.pl_krs
      && companyRegistration(row.records[0]).status==="DEREGISTERED") return mapMgbiGeneralRecord(row.records[0],retrievedAt);
  return mapMgbiGeneralRecords(row.records,{type:"NIP",value:nip},retrievedAt);
}
export async function readArchivedCompanyGeneral(client: Pick<PoolClient,"query">, organizationId: string, nip: string): Promise<MgbiGeneralResult | null> {
  const row = (await client.query<Archive>(COMPANY_GENERAL_ARCHIVE_SQL,[nip,organizationId])).rows[0];
  return row ? projectCompanyGeneralArchive(row,nip) : null;
}
