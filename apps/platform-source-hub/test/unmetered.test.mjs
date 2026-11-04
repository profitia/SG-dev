// SYNTHETIC_ONLY. Disposable loopback SQL; no real identities, keys or provider calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import pg from 'pg';
import {unmeteredSourceSchemaDigest} from '@profitia/platform-contracts/platform-ingestion';
import {fixture} from './fixtures.mjs';
import {sourceDefinition,SOURCE_DEFINITIONS} from '../src/admission.mjs';
import {migrate} from '../scripts/migrate.mjs';
const intent=value=>createHash('sha256').update(value).digest('hex');

test('SYNTHETIC_ONLY: six explicit UNMETERED APIs keep audit, uncertain attempts and current revocation without a request quota',async t=>{
 const f=await fixture();let migrator;t.after(async()=>{try{await migrator?.end();}finally{await f.close();}});
 const u=new URL(process.env.SOURCE_HUB_TEST_ADMIN_URL);u.pathname='/'+f.hub.databaseName;u.username='source_hub_development_migrator';u.password='SYNTHETIC_ONLY_NOT_A_REAL_CREDENTIAL';
 migrator=new pg.Client({connectionString:u.href,ssl:false});await migrator.connect();
 const digest=await unmeteredSourceSchemaDigest();
 await assert.rejects(()=>migrate(migrator,{...f.hub,installUnmetered:true}),/Disabled Source bindings/);
 await f.admin(0,'profitia_ingestion_owner',q=>q.query("UPDATE profitia_ingestion.runtime_bindings SET status='REVOKED'"));
 for(let i=0;i<2;i++)assert.equal((await migrate(migrator,{...f.hub,installUnmetered:true})).unmeteredSourceSchemaDigest,digest);
 await f.admin(0,'profitia_ingestion_owner',q=>q.query("UPDATE profitia_ingestion.runtime_bindings SET status='ACTIVE'"));
 assert.equal(f.admission.binding.unmeteredSchemaDigest,digest);
 const licences=[];
 await f.admin(0,'profitia_ingestion_owner',async q=>{
  await q.query("UPDATE profitia_ingestion.budgets SET quota_mode='UNMETERED',capacity=NULL,window_start=NULL,window_end=NULL,expires_at=NULL");
  for(const key of Object.keys(SOURCE_DEFINITIONS)){
   const [provider,family]=key.split(':'),d=sourceDefinition(provider,family),policy=randomUUID();
   const {rows:[old]}=await q.query("SELECT * FROM profitia_external_call.policies WHERE source_id=$1 AND status='ACTIVE'",[d.sourceId]);
   await q.query("UPDATE profitia_external_call.policies SET status='REVOKED' WHERE policy_id=$1",[old.policy_id]);
   await q.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref,quota_mode) SELECT $1,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,NULL,NULL,NULL,NULL,'ACTIVE','SYNTHETIC_ONLY','UNMETERED' FROM profitia_external_call.policies WHERE policy_id=$2",[policy,old.policy_id]);
   await q.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,version,expires_at,source_ref) SELECT $1,1,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,'ACTIVE',1,expires_at,'SYNTHETIC_ONLY' FROM profitia_external_native.policies WHERE policy_id=$2",[policy,old.policy_id]);
   licences.push({provider,family,d,policy});
  }
 });
 await f.admin(0,'source_hub_development_owner',async q=>{for(const l of licences){await q.query('UPDATE source_hub.provider_licences SET source_policy_id=$1,retention_seconds=0 WHERE provider_id=$2 AND family=$3',[l.policy,l.provider,l.family]);l.licence=(await q.query('SELECT * FROM source_hub.provider_licences WHERE provider_id=$1 AND family=$2',[l.provider,l.family])).rows[0];}});
 assert.equal(await f.admission.ready(),true);
 for(const l of licences)await t.test(l.provider+' '+l.family+' admits the fourth request without an internal quota',async()=>{
  const {rows:[{descriptor}]}=await f.sdb.query('SELECT profitia_external_native.descriptor($1,$2) AS descriptor',[l.d.sourceId,l.d.resourceId]);
  assert.equal(descriptor.quotaMode,'UNMETERED');assert.equal(descriptor.capacity,null);assert.equal(descriptor.unmeteredSchemaDigest,digest);
  for(let i=0;i<4;i++){const transport=await f.admission.transportFor(l.provider,l.family,l.licence,intent(l.d.sourceId+':'+i));assert.equal((await transport.fetchImpl(l.d.origin+l.d.paths[0]+'?q=SYNTHETIC_ONLY')).status,200);}
 });
 assert.equal(f.state.providerCalls.length,24);
 const news=licences.find(l=>l.provider==='newsapi');
 f.state.beforeResponse=()=>{throw Error('SYNTHETIC_UNCERTAIN_RESPONSE');};
 const uncertain=await f.admission.transportFor(news.provider,news.family,news.licence,intent('unmetered-uncertain'));
 await assert.rejects(()=>uncertain.fetchImpl(news.d.origin+news.d.paths[0]+'?q=SYNTHETIC_ONLY'),{code:'EXTERNAL_RESULT_UNVERIFIED'});f.state.beforeResponse=null;
 await f.admin(0,'profitia_ingestion_owner',async q=>{
  const {rows:[p]}=await q.query('SELECT admitted_count,capacity,window_start,window_end,expires_at FROM profitia_external_call.policies WHERE policy_id=$1',[news.policy]);assert.equal(Number(p.admitted_count),5);for(const k of ['capacity','window_start','window_end','expires_at'])assert.equal(p[k],null);
  const {rows:[b]}=await q.query('SELECT consumed_count,capacity FROM profitia_ingestion.budgets WHERE source_id=$1',[news.d.sourceId]);assert.equal(Number(b.consumed_count),15);assert.equal(b.capacity,null);
  assert.equal((await q.query("SELECT count(*)::int AS count FROM profitia_external_call.calls WHERE policy_id=$1 AND status='UNVERIFIED'",[news.policy])).rows[0].count,1);
 });
 const before=f.state.providerCalls.length;
 await f.admin(0,'profitia_ingestion_owner',q=>q.query("UPDATE profitia_ingestion.grants SET status='REVOKED' WHERE source_id=$1",[news.d.sourceId]));
 await assert.rejects(()=>f.admission.transportFor(news.provider,news.family,news.licence,intent('revoked-unmetered')));
 assert.equal(f.state.providerCalls.length,before);assert.equal(await f.admission.ready(),false);
});

