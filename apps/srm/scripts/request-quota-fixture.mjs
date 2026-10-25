/** Disposable loopback supplierBusinessFixture only; never a cloud installer. */
export async function installRequestQuotaFixture(f){
 if(!f.baseBinding.projectId.startsWith('isolated-')||!f.baseBinding.databaseName.startsWith('srm_service_business_'))throw Error('Isolated quota fixture required')
 await f.owner.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
 await f.owner.query(`GRANT CREATE ON DATABASE ${f.baseBinding.databaseName} TO profitia_access_owner`)
 try{await f.controlled(async()=>{
  const apps=(await f.owner.query('SELECT application_id,status FROM profitia_access.applications')).rows
  await f.owner.query("UPDATE profitia_access.applications SET status='DISABLED'")
  for(const[name,table]of[['017-additional-request-operations.sql','profitia_requests.operation_installation'],['019-supplier-location-operations.sql','profitia_requests.location_installation'],['020-supplier-location-admission.sql','profitia_requests.location_admission_installation']]){
   const sql=f.core(name);await f.owner.query(sql);await f.owner.query(`INSERT INTO ${table} VALUES(true,'1.0.0',$1,'ISOLATED_QUOTA_FIXTURE')`,[f.hash(sql)])
  }
  const sql=f.core('027-unmetered-supplier-requests.sql');await f.owner.query("SELECT set_config('profitia.install.request_quota_digest',$1,true)",[f.hash(sql)]);await f.owner.query(sql)
  await f.owner.query(`GRANT EXECUTE ON FUNCTION profitia_requests.operation_runtime_descriptor(),profitia_requests.quota_runtime_descriptor(),profitia_requests.quota_policy(text,uuid,uuid,text),profitia_requests.quota_reserve(text,uuid,uuid,text,text,text,text,uuid,uuid,bigint),profitia_requests.quota_accept(text,uuid,uuid) TO ${f.FOREGROUND}`)
  await f.owner.query("UPDATE profitia_requests.policies SET quota_mode='UNMETERED',version=version+1,source_ref='ISOLATED_OWNER_UNMETERED' WHERE operation='supplier.report.refresh' AND status='ACTIVE'")
  for(const app of apps)await f.owner.query('UPDATE profitia_access.applications SET status=$1 WHERE application_id=$2',[app.status,app.application_id])
 });f.humanOptions.requestLedger.quotaSchemaDigest=f.hash(f.core('027-unmetered-supplier-requests.sql'))}finally{await f.owner.query(`REVOKE CREATE ON DATABASE ${f.baseBinding.databaseName} FROM profitia_access_owner`)}
}
