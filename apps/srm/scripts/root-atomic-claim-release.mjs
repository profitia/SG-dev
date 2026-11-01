import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import pg from 'pg'
import {rootAtomicClaimSchemaUrl} from '@profitia/platform-root-atomic-claim'
import {readyReportReleasePlan,executeReadyReportRelease} from './ready-report-release.mjs'

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8')
const target=Object.freeze(JSON.parse(read('deployment/root-atomic-claim-targets.json')))
const hash=value=>createHash('sha256').update(value).digest('hex')
const fail=message=>{throw Error(message)}
const plans=new WeakSet()
const check=condition=>`DO $check$ BEGIN IF NOT (${condition}) THEN RAISE EXCEPTION 'Exact main Development Root claim release refused';END IF;END $check$`

/** Pure plan only. The existing release executor owns the one transaction,
 * strict three-binding CAS and restoration of the operator's original grants. */
export function rootClaimReleasePlan({mode,sourceSha,previousSha}){
 if(!['install-bind','rollback-bind'].includes(mode))fail('Explicit Root claim release mode required')
 if(target.environment!=='development'||target.serviceId!=='srv-db1vu6gm7kps73d0e3r0'
  ||target.projectId!=='spring-bread-28217539'||target.branchId!=='br-sparkling-term-b99l107x'
  ||target.databaseName!=='platform_private'||target.foregroundRole!=='srm_private_development_runtime'
  ||target.executorRole!=='srm_private_development_jobs'||target.enabledByDefault!==false
  ||target.producerSourceRef!=='3a494b5432555935168c060be5950589d550d276')fail('Exact main Development Root claim target required')
 const migration=fs.readFileSync(new URL(rootAtomicClaimSchemaUrl),'utf8')
 if(hash(migration)!==target.schemaDigest)fail('Exact producer Root claim SQL required')
 const base=readyReportReleasePlan({mode:mode==='install-bind'?'bind':'rollback-bind',sourceSha,previousSha})
 const index=base.statements.findIndex(s=>s.text.startsWith('UPDATE profitia_services.runtime_bindings'))
 if(index<1||!base.statements[index-1].text.includes('srm.ready_report_installation'))fail('Existing exact release boundary required')
 const additional=[],add=(text,values=[])=>additional.push({text,values})
 if(mode==='install-bind'){
  add(check("to_regnamespace('profitia_root_claim') IS NULL AND NOT has_database_privilege('profitia_access_owner','platform_private','CREATE')"))
  add('RESET ROLE')
  add('GRANT CREATE ON DATABASE platform_private TO profitia_access_owner')
  add('SET LOCAL ROLE profitia_access_owner')
  add(migration)
  add("INSERT INTO profitia_root_claim.installation(singleton,schema_version,schema_digest,source_ref) VALUES(true,'1.0.0',$1,$2)",[target.schemaDigest,target.producerSourceRef])
  add(`INSERT INTO profitia_root_claim.receivers(foreground_role,executor_role,enabled,expires_at,source_ref)
   SELECT $1,$2,true,expires_at,$3 FROM profitia_services.runtime_bindings
   WHERE login_role=$2 AND status='ACTIVE' AND expires_at>clock_timestamp()
    AND deployment_id=$4 RETURNING foreground_role`,
   [target.foregroundRole,target.executorRole,sourceSha,target.serviceId+':'+previousSha+':srm-jobs'])
  add(`GRANT USAGE ON SCHEMA profitia_root_claim TO ${target.foregroundRole},${target.executorRole}`)
  add(`GRANT EXECUTE ON FUNCTION profitia_root_claim.runtime_descriptor(),profitia_root_claim.claim_dispatch(uuid,uuid,text,text) TO ${target.foregroundRole}`)
  add(`GRANT EXECUTE ON FUNCTION profitia_root_claim.bind_delivery(uuid,uuid,uuid,text) TO ${target.executorRole}`)
  add(check(`(SELECT count(*)=3 AND bool_and(relrowsecurity AND relforcerowsecurity AND relowner='profitia_access_owner'::regrole)
   FROM pg_class WHERE oid IN('profitia_root_claim.installation'::regclass,'profitia_root_claim.receivers'::regclass,'profitia_root_claim.claim_log'::regclass))
   AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['${target.foregroundRole}','${target.executorRole}']) r(role)
    CROSS JOIN unnest(ARRAY['installation','receivers','claim_log']) t(tab)
    WHERE has_table_privilege(r.role,'profitia_root_claim.'||t.tab,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR has_any_column_privilege(r.role,'profitia_root_claim.'||t.tab,'SELECT,INSERT,UPDATE,REFERENCES'))`))
  add('RESET ROLE')
  add('REVOKE CREATE ON DATABASE platform_private FROM profitia_access_owner')
  add('SET LOCAL ROLE profitia_access_owner')
  add(check("NOT has_database_privilege('profitia_access_owner','platform_private','CREATE')"))
 }else{
  add(check(`EXISTS(SELECT 1 FROM profitia_root_claim.installation WHERE singleton AND schema_digest='${target.schemaDigest}')`))
  add(`UPDATE profitia_root_claim.receivers SET enabled=false,source_ref=$1
   WHERE foreground_role=$2 AND executor_role=$3 AND enabled RETURNING foreground_role`,
   [sourceSha,target.foregroundRole,target.executorRole])
 }
 const statements=[...base.statements.slice(0,index),...additional,...base.statements.slice(index)]
 const plan=Object.freeze({...base,target,mode,statements:Object.freeze(statements.map(s=>Object.freeze({text:s.text,values:Object.freeze([...s.values])})))})
 plans.add(plan)
 return plan
}

export async function executeRootClaimRelease(client,plan,{apply=false}={}){
 if(!plans.has(plan)||typeof apply!=='boolean')fail('Unmodified locally constructed Root claim plan required')
 const guarded={...client,query:async(text,values)=>{
  const result=await client.query(text,values)
  if(/^(?:INSERT INTO|UPDATE) profitia_root_claim\./.test(text)&&result.rowCount!==1)fail('Exact single Root installation or receiver required')
  return result
 }}
 const result=await executeReadyReportRelease(guarded,plan,{apply})
 return {...result,rootClaimReceiverEnabled:apply&&plan.mode==='install-bind',rootClaimHistoryDeleted:false,
  newLoginRolesCreated:false,expiryOrOriginalProviderCountersReset:false}
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const values={},flags=new Set()
 for(let i=2;i<process.argv.length;i++){
  const key=process.argv[i]
  if(['--apply','--plan'].includes(key)){if(flags.has(key))fail('Duplicate release option');flags.add(key)}
  else if(['--mode','--sha','--previous-sha'].includes(key)){
   if(Object.hasOwn(values,key)||!process.argv[i+1]||process.argv[i+1].startsWith('--'))fail('Exact release option required')
   values[key]=process.argv[++i]
  }else fail('Unknown Root claim release option')
 }
 if(flags.has('--plan')&&flags.has('--apply'))fail('A pure plan cannot apply changes')
 const plan=rootClaimReleasePlan({mode:values['--mode'],sourceSha:values['--sha'],previousSha:values['--previous-sha']})
 if(flags.has('--plan'))console.log(JSON.stringify({mode:plan.mode,target:plan.target,statementCount:plan.statements.length,mutationsPerformed:false}))
 else{
  const acceptance=JSON.parse(read('operation-integration.json')).rootAtomicClaimAdoption
  if(acceptance?.producerSourceRef!==target.producerSourceRef||acceptance?.schemaDigest!==target.schemaDigest
   ||acceptance?.sourceDigest!==target.sourceDigest||acceptance?.producerAcceptance?.status!=='SOURCE_GO')fail('Formal exact producer acceptance required before a database transaction')
  const url=new URL(process.env.SRM_ROOT_CLAIM_RELEASE_DIRECT_URL??'')
  if(process.env.TARGET_ENVIRONMENT!=='development'||url.hostname!=='ep-late-heart-b9mxo8oi.c-7.eu-central-1.aws.neon.tech'
   ||url.username!=='neondb_owner'||url.pathname!=='/platform_private'||url.searchParams.get('sslmode')!=='require'
   ||url.port&&url.port!=='5432'||url.hash)fail('Registered direct Development operator required')
  if(flags.has('--apply')){
   const backup=process.env.SRM_ROOT_CLAIM_SCHEMA_BACKUP,expected=process.env.SRM_ROOT_CLAIM_SCHEMA_BACKUP_SHA256
   if(!backup||!/^[a-f0-9]{64}$/.test(expected??'')||hash(fs.readFileSync(backup))!==expected)fail('Verified pre-release schema backup required')
  }
  const client=new pg.Client({connectionString:url.toString()});await client.connect()
  try{console.log(JSON.stringify(await executeRootClaimRelease(client,plan,{apply:flags.has('--apply')})))}finally{await client.end()}
 }
}
