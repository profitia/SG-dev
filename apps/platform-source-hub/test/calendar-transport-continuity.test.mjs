// SYNTHETIC_ONLY loopback PostgreSQL and mocked HTTP. No provider or live DB.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import {fixture} from '../../newsfeed-runtime/test/fixtures.mjs'
import {createAdmission,sourceDefinition} from '../src/admission.mjs'
const require=createRequire(new URL('../package.json',import.meta.url)),{Client}=require('pg')
const load=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex')
const sql=load('../operations/replace-ecr-calendar-transport.sql'),owner='source_hub_development_owner',ingestion='profitia_ingestion_owner'
const definition=sourceDefinition('eia','publication-calendar'),expanded=sourceDefinition('eia','publication-calendar',{includeExpandedSchedules:true})
const plan={oldPolicyId:randomUUID(),forwardPolicyId:randomUUID(),rollbackPolicyId:randomUUID()}
async function setup(){
 const f=await fixture(),id=plan.oldPolicyId
 const scopeDefs=[['eia','publication-calendar',definition],['eia','series-observations',sourceDefinition('eia','series-observations')],['commodities-sh','publication-calendar',sourceDefinition('commodities-sh','publication-calendar')]]
 const policyIds=new Map(scopeDefs.map(([p,f,d])=>[d.sourceId,d.sourceId===definition.sourceId?id:randomUUID()]))
 try{
  await f.admin(0,ingestion,async q=>{
   await q.query("UPDATE profitia_ingestion.runtime_bindings SET status='REVOKED'")
   const s=load('../../../packages/platform-contracts/migrations/access/024-unmetered-public-sources.sql')
   await q.query("SELECT set_config('profitia.install.unmetered_digest',$1,true)",[hash(s)]);await q.query(s)
   await q.query('DISCARD PLANS')
   await q.query("UPDATE profitia_ingestion.runtime_bindings SET status='ACTIVE'")
   for(const [provider,family,d] of scopeDefs){const selectedId=policyIds.get(d.sourceId)
   await q.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE','external-call-control-v1','source-hub-api-control-v1','TECHNICAL_CONTROL_NO_PRIVATE_DATA','source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[d.sourceId])
   await q.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,resource_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),f.hub.sourceRole,d.sourceId,d.resourceId])
   await q.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref,quota_mode) VALUES($1,$2,$3,'SOURCE_TRANSACTION',NULL,NULL,NULL,NULL,'ACTIVE','SYNTHETIC_ONLY','UNMETERED')",[randomUUID(),f.hub.applicationId,d.sourceId])
   await q.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref,quota_mode) VALUES($1,$2,$3,$4,$5,$6,'HTTPS',$7::jsonb,16384,2097152,15000,'UPSTREAM_ATTEMPT_ADMISSION',NULL,NULL,NULL,NULL,'ACTIVE','SYNTHETIC_ONLY','UNMETERED')",[selectedId,f.hub.sourceRole,d.sourceId,d.resourceId,f.hub.configurationVersion,d.origin,JSON.stringify(d.pathRules)])
   await q.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) VALUES($1,1,$2::jsonb,'[]',2097152,'SERVER_HEADERS','ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',now()+interval '1 hour','SYNTHETIC_ONLY')",[selectedId,JSON.stringify(d.nativePathRules)])
   }
  })
  await f.admin(0,'profitia_access_owner',async q=>{
   await q.query('RESET ROLE');await q.query('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public')
   await q.query("CREATE ROLE economic_calendar_development_source_monitor LOGIN PASSWORD 'SYNTHETIC_ONLY_NOT_A_REAL_CREDENTIAL' NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION")
   await q.query('SET LOCAL ROLE profitia_access_owner')
   await q.query(load('../../../packages/platform-contracts/current-e1-authority/migrations/002-receiver.sql'))
   await q.query(load('../../../packages/platform-contracts/current-e1-authority/migrations/004-first-party-receiver.sql'))
   await q.query('GRANT USAGE ON SCHEMA profitia_e1_receiver TO '+owner)
  })
  await f.admin(0,owner,async q=>{
   for(const v of ['004-universal-consumers','006-commodity-providers','007-publication-schedules']){
    const s=load('../migrations/'+v+'.sql');await q.query(s);await q.query('INSERT INTO source_hub.migrations(version,digest) VALUES($1,$2)',[v,hash(s)])
   }
   const s=load('../migrations/010-ecr-source-continuity.sql')
   await q.query(s.slice(0,s.indexOf('CREATE FUNCTION source_hub.ecr_monitor_session()')))
   await q.query(s.match(/CREATE FUNCTION source_hub\.ecr_monitor_session\(\).*?\$fn\$;/s)[0])
   await q.query(s.slice(s.indexOf('CREATE FUNCTION source_hub.ecr_control_fingerprint('),s.indexOf('CREATE FUNCTION source_hub.ecr_source_policy()')))
   await q.query('GRANT USAGE ON SCHEMA source_hub TO '+ingestion)
   await q.query('GRANT EXECUTE ON FUNCTION source_hub.ecr_control_fingerprint(jsonb) TO '+ingestion)
   await q.query('REVOKE ALL ON FUNCTION source_hub.ecr_monitor_session() FROM PUBLIC')
   await q.query('GRANT EXECUTE ON FUNCTION source_hub.ecr_monitor_session() TO '+ingestion)
   await q.query(s.match(/CREATE FUNCTION source_hub\.ecr_source_policy\(\).*?\$fn\$;/s)[0])
   await q.query('REVOKE ALL ON FUNCTION source_hub.ecr_source_policy() FROM PUBLIC')
   await q.query('GRANT EXECUTE ON FUNCTION source_hub.ecr_source_policy() TO '+ingestion)
   await q.query("INSERT INTO source_hub.provider_licences(provider_id,family,licence_ref,version,source_id,resource_id,source_policy_id,private_consumer_use,consumer_application_ids,retention_seconds,redistribution,status,expires_at,consumer_access_mode) VALUES('eia','publication-calendar','source-hub-eia-official-publication-schedules-20261109',1,$1,$2,$3,true,ARRAY['synthetic-legacy-only'],0,'PRIVATE_AUTHORISED_CONSUMER_ONLY','ACTIVE',now()+interval '1 hour','SPENDGURU_PRODUCT')",[definition.sourceId,definition.resourceId,id])
  })
  await f.admin(0,owner,async q=>{for(const [provider,family,d] of scopeDefs.filter(x=>x[2].sourceId!==definition.sourceId))await q.query("INSERT INTO source_hub.provider_licences(provider_id,family,licence_ref,version,source_id,resource_id,source_policy_id,private_consumer_use,consumer_application_ids,retention_seconds,redistribution,status,expires_at,consumer_access_mode) VALUES($1,$2,'SYNTHETIC_ONLY',1,$3,$4,$5,true,ARRAY['synthetic-legacy-only'],0,'PRIVATE_AUTHORISED_CONSUMER_ONLY','ACTIVE',now()+interval '1 hour','SPENDGURU_PRODUCT')",[provider,family,d.sourceId,d.resourceId,policyIds.get(d.sourceId)])})
  const continuity=load('../migrations/010-ecr-source-continuity.sql')
  await f.admin(0,ingestion,async q=>{
   await q.query(continuity.match(/CREATE FUNCTION profitia_ingestion\.ecr_source_status\(\) RETURNS jsonb.*?\$fn\$;/s)[0])
   await q.query('REVOKE ALL ON FUNCTION profitia_ingestion.ecr_source_status() FROM PUBLIC')
   await q.query('GRANT EXECUTE ON FUNCTION profitia_ingestion.ecr_source_status() TO '+owner)
   await q.query(continuity.match(/CREATE FUNCTION profitia_ingestion\.extend_ecr_sources\(deadline timestamptz\) RETURNS boolean.*?\$fn\$;/s)[0])
   await q.query('REVOKE ALL ON FUNCTION profitia_ingestion.extend_ecr_sources(timestamptz) FROM PUBLIC')
   await q.query('GRANT EXECUTE ON FUNCTION profitia_ingestion.extend_ecr_sources(timestamptz) TO '+owner)
   await q.query('GRANT USAGE ON SCHEMA profitia_ingestion TO '+owner)
  })
  await f.admin(0,owner,async q=>{
   await q.query('CREATE FUNCTION source_hub.synthetic_transport_status() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$ SELECT profitia_ingestion.ecr_source_status() $fn$')
   await q.query('REVOKE ALL ON FUNCTION source_hub.synthetic_transport_status() FROM PUBLIC')
   await q.query('GRANT USAGE ON SCHEMA source_hub TO economic_calendar_development_source_monitor')
   await q.query('GRANT EXECUTE ON FUNCTION source_hub.synthetic_transport_status() TO economic_calendar_development_source_monitor')
   await q.query('CREATE FUNCTION source_hub.synthetic_transport_renewal() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$ SELECT profitia_ingestion.extend_ecr_sources(clock_timestamp()+interval \'2 hours\') $fn$')
   await q.query('REVOKE ALL ON FUNCTION source_hub.synthetic_transport_renewal() FROM PUBLIC')
   await q.query('GRANT EXECUTE ON FUNCTION source_hub.synthetic_transport_renewal() TO economic_calendar_development_source_monitor')
   await q.query("INSERT INTO source_hub.migrations(version,digest) VALUES('010-ecr-source-continuity',$1)",[hash(continuity)])
  })
  f.hub.commodityProviders=['eia'];f.hub.eiaSchedulesEnabled=true;const delegate=globalThis.fetch
  globalThis.fetch=async(url,o)=>{if(new URL(url).hostname!=='www.eia.gov')return delegate(url,o);const r=new Response('<html>SYNTHETIC_ONLY</html>',{headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:String(url)});return r}
  const descriptor=await f.sdb.query('SELECT profitia_external_native.descriptor($1,$2) AS d',[definition.sourceId,definition.resourceId]);assert(descriptor.rows[0]?.d,'SYNTHETIC native descriptor required')
  const trackedQuery=async(...args)=>{try{return await f.sdb.query(...args)}catch(e){console.error('SYNTHETIC_SQL_DIAGNOSTIC',e.code,e.message);throw e}}
  const admission=await createAdmission(f.hub,{...f.sdb,query:trackedQuery}),licence={source_id:definition.sourceId,resource_id:definition.resourceId,source_policy_id:id}
  const transport=await admission.transportFor('eia','publication-calendar',licence,hash('synthetic-replacement-counter-'+randomUUID()))
  await transport.fetchImpl('https://www.eia.gov'+definition.paths[0],{})
  assert.equal(transport.receipt.upstreamAttempts,1)
  const base=new URL(process.env.SOURCE_HUB_TEST_ADMIN_URL);base.pathname='/'+f.hub.databaseName;base.username='source_hub_development_migrator';base.password='SYNTHETIC_ONLY_NOT_A_REAL_CREDENTIAL'
  const c=new Client({connectionString:base.href,ssl:false});await c.connect()
  const monitorUrl=new URL(base.href);monitorUrl.username='economic_calendar_development_source_monitor'
  const monitor=new Client({connectionString:monitorUrl.href,ssl:false});await monitor.connect()
  const state=async()=>{
   const answer={};await c.query('BEGIN READ ONLY');try{
    await c.query('SET LOCAL ROLE '+owner)
    const read=async(table,where)=>(await c.query(`SELECT to_jsonb(p) AS value,encode(public.digest(convert_to(to_jsonb(p)::text,'UTF8'),'sha256'),'hex') AS digest FROM ${table} p WHERE ${where}`)).rows[0]
    answer.licence=await read('source_hub.provider_licences',"provider_id='eia' AND family='publication-calendar'")
    answer.continuity=await read('source_hub.ecr_source_continuity_policy','singleton')
    await c.query('SET LOCAL ROLE '+ingestion)
    answer.external=await read('profitia_external_call.policies',"source_id='source-hub.eia.publication-calendar' AND status='ACTIVE'")
    answer.native=await read('profitia_external_native.policies',"policy_id='"+answer.external.value.policy_id+"'")
    return answer
   }finally{await c.query('ROLLBACK')}
  }
  const monitorStatus=async()=>(await monitor.query('SELECT source_hub.synthetic_transport_status() AS result')).rows[0].result
  const monitorRenew=async()=>(await monitor.query('SELECT source_hub.synthetic_transport_renewal() AS result')).rows[0].result
  const initial=await monitorStatus();assert.equal(initial.length,16);assert(initial.every(x=>x.status==='ACTIVE'))
  const fingerprints=Object.fromEntries(initial.map(x=>[x.id,x.fingerprint]));fingerprints['unrelated-sentinel']='PRESERVE_EXACTLY'
  const licences=await f.admin(0,owner,q=>q.query("SELECT source_id,source_hub.ecr_control_fingerprint(to_jsonb(l)) AS fingerprint FROM source_hub.provider_licences l WHERE(provider_id='eia' AND family IN('publication-calendar','series-observations')) OR(provider_id='commodities-sh' AND family='publication-calendar')"));for(const l of licences.rows)fingerprints['licence:'+l.source_id]=l.fingerprint
  assert.equal(Object.keys(fingerprints).length,20)
  await f.admin(0,owner,q=>q.query("INSERT INTO source_hub.ecr_source_continuity_policy VALUES(true,'ACTIVE',$1,'NO_FIXED_EXPIRY_OWNER_ATTESTED',NULL,$2::jsonb,now()+interval '1 hour',clock_timestamp())",['owner-decision:sha256:'+'a'.repeat(64),JSON.stringify(fingerprints)]))
  const installSelection=async()=>{await c.query('BEGIN');try{await c.query('SET LOCAL ROLE '+owner);const s=load('../migrations/012-calendar-transport-continuity.sql');await c.query(s);await c.query("INSERT INTO source_hub.migrations(version,digest) VALUES('012-calendar-transport-continuity',$1)",[hash(s)]);await c.query('COMMIT')}catch(e){await c.query('ROLLBACK');throw e}}
  return{...f,c,state,monitorStatus,monitorRenew,installSelection,async close(){await monitor.end();await c.end();await f.close()}}
 }catch(e){await f.close();throw e}
}
const spec=(before,to,paths)=>({fromPolicyId:before.external.value.policy_id,toPolicyId:to,decisionRef:'owner-decision:sha256:'+'b'.repeat(64),pathRules:paths,externalRowSha256:before.external.digest,nativeRowSha256:before.native.digest,licenceRowSha256:before.licence.digest,continuityRowSha256:before.continuity.digest})
async function execute(c,s){await c.query('BEGIN');try{await c.query("SELECT set_config('ecr.transport.replacement_spec',$1,true)",[JSON.stringify(s)]);await c.query(sql);await c.query('COMMIT')}catch(e){await c.query('ROLLBACK');throw e}}
test('SYNTHETIC real PostgreSQL: immutable definition refusal, CAS, exact replacement, replay refusal and safe rollback preserve used history',async t=>{
 const f=await setup();try{
  const before=await f.state();assert.equal(Number(before.external.value.admitted_count),1)
  await t.test('same-ID path update is genuinely refused by the original enabled trigger',async()=>{await assert.rejects(f.admin(0,ingestion,q=>q.query('UPDATE profitia_external_native.policies SET path_rules=$1::jsonb WHERE policy_id=$2',[JSON.stringify(expanded.nativePathRules),plan.oldPolicyId])),{code:'42501'});assert.deepEqual(await f.state(),before)})
  const forward=spec(before,plan.forwardPolicyId,expanded.pathRules)
  await t.test('stale whole-row CAS refuses without partial effects',async()=>{await assert.rejects(execute(f.c,{...forward,nativeRowSha256:'0'.repeat(64)}));assert.deepEqual(await f.state(),before)})
  await t.test('one exact new pair succeeds with no trigger changes and no refunded old admission',async()=>{await execute(f.c,forward);const after=await f.state();assert.equal(after.external.value.policy_id,plan.forwardPolicyId);assert.equal(after.external.value.quota_mode,'UNMETERED');assert.equal(after.external.value.admitted_count,0);assert.equal(after.native.value.expires_at,before.native.value.expires_at);assert.equal(after.licence.value.retention_seconds,0);assert.equal(after.continuity.value.expected_fingerprints['unrelated-sentinel'],'PRESERVE_EXACTLY');assert.deepEqual(after.external.value.path_rules,expanded.pathRules);const old=await f.admin(0,ingestion,q=>q.query('SELECT status,admitted_count::integer AS admitted_count FROM profitia_external_call.policies WHERE policy_id=$1',[plan.oldPolicyId]));assert.deepEqual(old.rows,[{status:'REVOKED',admitted_count:1}])})
  await t.test('original monitor really includes revoked history; exact012 selects only current calendar and retains EXECUTE ACL',async()=>{
   const relevant=d=>d.filter(x=>['external:'+definition.sourceId,'native:'+definition.sourceId].includes(x.id))
   const original=relevant(await f.monitorStatus());assert.equal(original.length,4);assert(original.some(x=>x.status==='REVOKED'))
   const acl=() => f.c.query("SELECT p.proacl::text AS acl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname IN('ecr_source_status','extend_ecr_sources') AND n.nspname='profitia_ingestion' ORDER BY p.proname")
   const oldAcl=(await acl()).rows;await f.installSelection();assert.deepEqual((await acl()).rows,oldAcl)
   const current=relevant(await f.monitorStatus());assert.equal(current.length,2);assert(current.every(x=>x.status==='ACTIVE'))
   const state=await f.state();for(const x of current)assert.equal(x.fingerprint,state.continuity.value.expected_fingerprints[x.id])
  })
  await t.test('actual ordinary monitor renewal extends only the current pair and preserves obsolete expiry and counter',async()=>{
   assert.equal(await f.monitorRenew(),true)
   const current=await f.state();assert(Date.parse(current.native.value.expires_at)>Date.parse(before.native.value.expires_at))
   const old=await f.admin(0,ingestion,q=>q.query('SELECT n.expires_at,e.admitted_count::integer AS admitted_count FROM profitia_external_native.policies n JOIN profitia_external_call.policies e USING(policy_id) WHERE n.policy_id=$1',[plan.oldPolicyId]));assert.equal(old.rows[0].expires_at.toISOString(),new Date(before.native.value.expires_at).toISOString());assert.equal(old.rows[0].admitted_count,1)
   const dependencies=await f.monitorStatus();assert.equal(dependencies.length,16);assert(dependencies.every(x=>x.status==='ACTIVE'));for(const d of dependencies)assert.equal(d.fingerprint,current.continuity.value.expected_fingerprints[d.id])
  })
  await t.test('replay refuses and cannot create duplicate policies',async()=>{const after=await f.state();await assert.rejects(execute(f.c,forward));assert.deepEqual(await f.state(),after)})
  await t.test('rollback creates its own exact original-path pair while retaining all historical counters',async()=>{const after=await f.state();await execute(f.c,spec(after,plan.rollbackPolicyId,definition.pathRules));const rolled=await f.state();assert.equal(rolled.external.value.policy_id,plan.rollbackPolicyId);assert.deepEqual(rolled.external.value.path_rules,definition.pathRules);assert.equal(rolled.native.value.expires_at,after.native.value.expires_at);const total=await f.admin(0,ingestion,q=>q.query("SELECT count(*)::integer AS policies,sum(admitted_count)::integer AS admissions FROM profitia_external_call.policies WHERE source_id='source-hub.eia.publication-calendar'"));assert.deepEqual(total.rows,[{policies:3,admissions:1}])})
  await t.test('revoking the only active replacement still produces a denial state; old history cannot restore it',async()=>{
   await f.admin(0,ingestion,async q=>{await q.query("UPDATE profitia_external_native.policies SET status='REVOKED' WHERE policy_id=$1",[plan.rollbackPolicyId]);await q.query("UPDATE profitia_external_call.policies SET status='REVOKED' WHERE policy_id=$1",[plan.rollbackPolicyId])})
   const current=(await f.monitorStatus()).filter(x=>['external:'+definition.sourceId,'native:'+definition.sourceId].includes(x.id));assert.equal(current.length,2);assert(current.every(x=>x.status==='REVOKED'))
   await assert.rejects(f.monitorRenew(),/ECR_SOURCE_CONTROL_REVOKED_EXPIRED_OR_DRIFTED/)
  })
 }finally{await f.close()}
})
