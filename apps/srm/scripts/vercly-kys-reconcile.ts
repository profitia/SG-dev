import pg from "pg";
import {createHash} from "node:crypto";
import {resumeVerclyKys} from "../src/server/vercly-kys";
import {assertProductConnection,productOrganizationId,productEnvironmentReady} from "../src/server/runtime-environment";

const nip = "5221054994";
const env = process.env;
async function main() {
  const target = env.TARGET_ENVIRONMENT;
  if (!["development","staging"].includes(target ?? "") || !productEnvironmentReady(env)) throw Error("WRONG_ENVIRONMENT");
  const org = productOrganizationId(env);
  if (!org) throw Error("NO_ORGANIZATION");
  const url = env.SRM_APP_DATABASE_URL ? new URL(env.SRM_APP_DATABASE_URL)
    : new URL("postgresql://srm_app_runtime@" + env.SRM_APP_DATABASE_HOST + "/srm_app");
  if (!env.SRM_APP_DATABASE_URL) {
    url.password = env.SRM_APP_DATABASE_PASSWORD ?? "";
    url.searchParams.set("sslmode","require");url.searchParams.set("channel_binding","require");
  }
  assertProductConnection(url.toString(),env);
  const client = new pg.Client({connectionString:url.toString()});
  await client.connect();
  const begin = async(readOnly=false) => {
    await client.query(readOnly ? "BEGIN READ ONLY" : "BEGIN");
    await client.query("SELECT set_config('srm.organization_id',$1,true)",[org]);
  };
  try {
    await begin(true);
    const row = (await client.query<{lease_owner:string|null;lease_until:string|null;report_sha256:string|null;updated_at:string;fresh:boolean}>(
      "SELECT lease_owner,lease_until::text,report_sha256,updated_at::text,retention_until>now() AS fresh FROM srm.catalog_kys_reports WHERE nip=$1 AND entity_type='COMPANY'",[nip])).rows[0];
    const attempt = (await client.query<{correlation_id:string}>(
      "SELECT a.correlation_id FROM srm.provider_attempts a JOIN srm.lookup_requests l ON l.organization_id=a.organization_id AND l.id=a.request_id WHERE l.organization_id=$1::uuid AND l.identifier=$2 AND l.entity_type='COMPANY' AND a.section='kys' AND a.provider='VERCLY' AND a.retrieval_method='PROVIDER' AND a.correlation_id IS NOT NULL ORDER BY a.started_at DESC LIMIT 1",[org,nip])).rows[0];
    await client.query("ROLLBACK");
    if(!row || !attempt || !/^[A-Za-z0-9_-]{8,100}$/.test(attempt.correlation_id)) throw Error("NO_EXISTING_ORDER");
    if(row.lease_owner && row.lease_until!=="infinity") throw Error("ACTIVE_FLIGHT");
    const result = await resumeVerclyKys({identifier:{type:"NIP",value:nip}},attempt.correlation_id,{pollTimeoutMs:20_000});
    if(result.section.status!=="SUCCESS" || result.section.data?.company?.nip!==nip || !result.section.retrievedAt)
      throw Error("EXISTING_REPORT_NOT_COMPLETE");
    const section = result.section, body = JSON.stringify(section);
    const digest = createHash("sha256").update(body).digest("hex");
    const summary = {environment:target,nip,status:section.status,stateAsOf:section.data?.stateAsOf,
      paidOrdersCreated:0,reportDigest:digest,apply:process.argv.includes("--apply")};
    if(!process.argv.includes("--apply")) {console.log(JSON.stringify({event:"KYS_RECONCILE_VERIFIED",...summary}));return;}
    // Match the exact observed row. Never unlock first, create another order, or
    // overwrite a newer flight/cache. The ordinary UI persists its tenant snapshot.
    await begin();
    const saved = await client.query(
      "UPDATE srm.catalog_kys_reports SET report_json=$1::jsonb,report_sha256=$2,retrieved_at=$3,retention_until=$4,source_organization_id=$5::uuid,source_snapshot_id=NULL,lease_owner=NULL,lease_until=NULL,updated_at=now() WHERE nip=$6 AND entity_type='COMPANY' AND lease_owner IS NOT DISTINCT FROM $7::uuid AND report_sha256 IS NOT DISTINCT FROM $8 AND updated_at=$9::timestamptz",
      [body,digest,new Date(section.retrievedAt!),new Date(Date.parse(section.retrievedAt!)+168*3600_000),org,nip,row.lease_owner,row.report_sha256,row.updated_at]);
    if(saved.rowCount!==1) throw Error("CACHE_CHANGED_DURING_RECOVERY");
    await client.query("COMMIT");
    console.log(JSON.stringify({event:"KYS_RECONCILED",...summary}));
  } catch(error) {await client.query("ROLLBACK").catch(()=>{});throw error;}
  finally {await client.end();}
}
main().catch(error=>{
 const safe = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "RECONCILIATION_FAILED";
 console.error(JSON.stringify({event:"KYS_RECONCILE_FAILED",code:safe,paidOrdersCreated:0}));process.exitCode=1;
});
