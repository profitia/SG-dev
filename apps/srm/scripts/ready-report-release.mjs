import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import pg from 'pg'
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8')
const target=JSON.parse(read('deployment/ready-report-targets.json'))
const native=JSON.parse(read('deployment/supplier-native-targets.json'))
const receipt=JSON.parse(read('operation-integration.json')).xrayPerformanceRecoveryV2
const hash=v=>createHash('sha256').update(v).digest('hex')
const fail=reason=>{throw Error(reason)}
export function readyReportReleasePlan({mode,sourceSha,previousSha}){
 if(!['prepare','bind','rollback-bind'].includes(mode)||!/^([a-f0-9]{40})$/.test(sourceSha??'')
  ||!/^([a-f0-9]{40})$/.test(previousSha??'')||sourceSha===previousSha)fail('Exact distinct source revisions required')
 if(target.environment!=='development'||target.serviceId!=='srv-db1vu6gm7kps73d0e3r0'
  ||target.projectId!=='spring-bread-28217539'||target.branchId!=='br-sparkling-term-b99l107x'
  ||target.databaseName!=='platform_private'||native.serviceId!==target.serviceId)fail('Main Development target required')
 const statements=[],add=(text,values=[])=>statements.push({text,values})
 const assertSql=condition=>`DO $check$ BEGIN IF NOT (${condition}) THEN RAISE EXCEPTION 'Exact main Development release precondition refused';END IF;END $check$`
 add(assertSql(`current_database()='platform_private' AND session_user='neondb_owner' AND (SELECT count(*) FROM pg_auth_members WHERE member=session_user::regrole AND grantor='cloud_admin'::regrole AND roleid IN('profitia_access_owner'::regrole,'profitia_ingestion_owner'::regrole) AND admin_option AND NOT inherit_option AND NOT set_option)=2 AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=session_user::regrole AND grantor=session_user::regrole AND roleid IN('profitia_access_owner'::regrole,'profitia_ingestion_owner'::regrole) AND admin_option)`))
 add('GRANT profitia_access_owner,profitia_ingestion_owner TO neondb_owner WITH ADMIN FALSE, INHERIT FALSE, SET TRUE')
 add('SET LOCAL ROLE profitia_access_owner')
 add(assertSql(`EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND environment='development' AND project_id='${target.projectId}' AND branch_id='${target.branchId}' AND database_name='${target.databaseName}')`))
 if(mode==='prepare'){
  add(assertSql(`to_regclass('srm.ready_report_installation') IS NULL AND EXISTS(SELECT 1 FROM profitia_services.runtime_bindings WHERE login_role='${native.runtimeRoles.jobs}' AND status='ACTIVE' AND deployment_id LIKE '${target.serviceId}:%:srm-jobs')`))
  add('SET LOCAL ROLE profitia_ingestion_owner')
  add('GRANT EXECUTE ON FUNCTION profitia_srm_catalog.valid_shape(jsonb,jsonb,jsonb,integer),profitia_srm_catalog.unique_keys(json,integer),profitia_srm_catalog.immutable() TO profitia_access_owner')
  add('SET LOCAL ROLE profitia_access_owner')
  for(const name of target.migrations)add(read('db/private-store/'+name))
  add('INSERT INTO srm.ready_report_installation(version,schema_digest,field_schema,rules,source_ref) VALUES($1,$2,$3::jsonb,$4::jsonb,$5)',
   [target.version,target.schemaDigest,read('src/server/ready-report-shape.json'),JSON.stringify(receipt.preparedReportRules),sourceSha])
  add('INSERT INTO srm.ready_company_work_installation SELECT true,$1,$2,login_role,service_id FROM profitia_services.runtime_bindings WHERE login_role=$3 AND status=\'ACTIVE\'',
   [target.workSchemaDigest,sourceSha,native.runtimeRoles.jobs])
  add(`GRANT SELECT,INSERT ON srm.ready_company_reports TO ${native.runtimeRoles.corporateSource}`)
  add('GRANT SELECT ON srm.ready_company_reports TO srm_private_development_runtime')
  add(`GRANT EXECUTE ON FUNCTION srm.ready_report_descriptor(),srm.publish_ready_report(text,uuid,text,text,text) TO ${native.runtimeRoles.corporateSource}`)
  add('GRANT EXECUTE ON FUNCTION srm.register_ready_report_read(uuid,uuid,text,text,uuid,jsonb) TO srm_private_development_runtime')
  add("INSERT INTO profitia_request_work.policies(application_id,unit_id,access_mode,status,source_ref,expires_at) SELECT 'srm','SRM_STORE_COMPANY','WRITE','ACTIVE',$1,expires_at FROM profitia_request_work.policies WHERE application_id='srm' AND unit_id='SRM_STORE_FINANCIAL' AND status='ACTIVE' AND expires_at>now()",[sourceSha])
 }else{
  const from=mode==='bind'?previousSha:sourceSha,to=mode==='bind'?sourceSha:previousSha
  add(assertSql(`EXISTS(SELECT 1 FROM srm.ready_report_installation WHERE singleton AND schema_digest='${target.schemaDigest}')`))
  add('UPDATE profitia_services.runtime_bindings SET deployment_id=$1,version=version+1,source_ref=$2 WHERE login_role=$3 AND deployment_id=$4 RETURNING login_role',
   [target.serviceId+':'+to+':srm-jobs',sourceSha,native.runtimeRoles.jobs,target.serviceId+':'+from+':srm-jobs'])
  add('SET LOCAL ROLE profitia_ingestion_owner')
  for(const[role,app]of[[native.runtimeRoles.providerSource,'srm-provider-source'],[native.runtimeRoles.corporateSource,'srm-corporate-source']])
   add('UPDATE profitia_ingestion.runtime_bindings SET deployment_id=$1,version=version+1,source_ref=$2 WHERE login_role=$3 AND application_id=$4 AND deployment_id=$5 RETURNING login_role',
    [target.serviceId+':'+to+':'+app,sourceSha,role,app,target.serviceId+':'+from+':'+app])
 }
 add('RESET ROLE')
 add('REVOKE profitia_access_owner,profitia_ingestion_owner FROM neondb_owner GRANTED BY neondb_owner')
 add(assertSql(`NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=session_user::regrole AND roleid IN('profitia_access_owner'::regrole,'profitia_ingestion_owner'::regrole) AND (set_option OR inherit_option OR grantor=session_user::regrole)) AND (SELECT count(*) FROM pg_auth_members WHERE member=session_user::regrole AND grantor='cloud_admin'::regrole AND roleid IN('profitia_access_owner'::regrole,'profitia_ingestion_owner'::regrole) AND admin_option AND NOT inherit_option AND NOT set_option)=2`))
 return Object.freeze({target,mode,sourceSha,previousSha,statements})
}
export async function executeReadyReportRelease(client,plan,{apply=false}={}){
 await client.query('BEGIN')
 try{
  await client.query("SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';SELECT pg_advisory_xact_lock(20261028,772)")
  for(const statement of plan.statements){
   const result=await client.query(statement.text,statement.values)
   if(/^UPDATE profitia_/.test(statement.text)&&result.rowCount!==1)fail('Exact single deployment binding required')
   if(/^INSERT INTO/.test(statement.text)&&result.rowCount!==1)fail('Exact single installation or policy required')
  }
  await client.query(apply?'COMMIT':'ROLLBACK')
  return {mode:plan.mode,applied:apply,sourceSha:plan.sourceSha,temporaryAdministrationRemoved:true,historyDeleted:false,paidPoliciesChanged:false}
 }catch(error){await client.query('ROLLBACK');throw error}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),value=key=>args[args.indexOf(key)+1]
 if(args.some((x,i)=>!['--mode','--sha','--previous-sha','--apply','--plan'].includes(x)&&!['--mode','--sha','--previous-sha'].includes(args[i-1])))fail('Unknown release option')
 const plan=readyReportReleasePlan({mode:value('--mode'),sourceSha:value('--sha'),previousSha:value('--previous-sha')})
 if(args.includes('--plan'))console.log(JSON.stringify({mode:plan.mode,target:plan.target,statementCount:plan.statements.length,mutationsPerformed:false}))
 else{
  const url=new URL(process.env.SRM_READY_RELEASE_DIRECT_URL??'')
  if(process.env.TARGET_ENVIRONMENT!=='development'||url.hostname!=='ep-late-heart-b9mxo8oi.c-7.eu-central-1.aws.neon.tech'
   ||url.username!=='neondb_owner'||url.pathname!=='/platform_private'||url.searchParams.get('sslmode')!=='require')fail('Registered direct Development operator required')
  if(args.includes('--apply')){
   const backup=process.env.SRM_READY_SCHEMA_BACKUP,expected=process.env.SRM_READY_SCHEMA_BACKUP_SHA256
   if(!backup||!expected||hash(fs.readFileSync(backup))!==expected)fail('Verified existing schema backup required')
  }
  const client=new pg.Client({connectionString:url.toString()});await client.connect()
  try{console.log(JSON.stringify(await executeReadyReportRelease(client,plan,{apply:args.includes('--apply')})))}finally{await client.end()}
 }
}
