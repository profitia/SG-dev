import {test,after} from 'node:test';import assert from 'node:assert/strict';
import pg from 'pg';import {randomUUID} from 'node:crypto';
import {transaction,digest} from '../src/store.mjs';import {claimJob,withJob} from '../src/jobs.mjs';
const uri=process.env.PK_TEST_DATABASE_URL;
let pool;
if(uri){const parsed=new URL(uri);if(!['127.0.0.1','localhost','pk-postgres'].includes(parsed.hostname)||parsed.pathname!=='/platform_knowledge')throw Error('ISOLATED_TEST_DATABASE_REQUIRED');
 pool=new pg.Pool({connectionString:uri,max:4});}
after(async()=>pool?.end());
const rights={classification:'UNKNOWN',purpose:'PRIVATE',organisationConstraintId:null,externalAiAllowed:true,quotingAllowed:true,apiExcerptAllowed:true};
const principal=user=>({internalUserId:user,organisationIds:[],allowedScopes:['ACCOUNT_PRIVATE'],sharedKnowledgeAllowed:false,operator:false,usePurpose:'CUSTOMER_SERVICE'});
async function fixture(db,owner,changes={}){
 const id=randomUUID(),generation=randomUUID();
 await db.query(`INSERT INTO platform_knowledge.sources(id,scope,owner_user_id,uploaded_by,request_id,file_name,media_type,size_bytes,sha256,rights,expires_at,raw_expires_at)
  VALUES($1,'ACCOUNT_PRIVATE',$2,$2,$3,'test.txt','text/plain',1,$4,$5,statement_timestamp()+interval '180 days',statement_timestamp()+interval '24 hours')`,[id,owner,id,'a'.repeat(64),JSON.stringify({...rights,...changes})]);
 await db.query(`INSERT INTO platform_knowledge.generations(id,source_id,parser_version,chunker_version,cognitive_model,embedding_model,embedding_dimensions,config_digest)
  VALUES($1,$2,'test','test','gpt-6-luna','text-embedding-3-small',1536,$3)`,[generation,id,'b'.repeat(64)]);
 return{id,generation};
}
test('actual PostgreSQL RLS isolates private users, org admin, missing context and retained organisation restrictions',{skip:!uri,timeout:10000},async()=>{
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 const db=await pool.connect();try{
  await db.query('BEGIN; SET LOCAL ROLE platform_knowledge_owner');const one=await fixture(db,a),restricted=await fixture(db,a,{organisationConstraintId:'org-old'});
  await db.query('SET LOCAL ROLE platform_knowledge_api');
  await db.query("SELECT set_config('pk.user_id',$1,true),set_config('pk.organisation_ids','[]',true),set_config('pk.allowed_scopes','[\"ACCOUNT_PRIVATE\"]',true),set_config('pk.operator','false',true),set_config('pk.purpose','CUSTOMER_SERVICE',true)",[a]);
  assert.equal((await db.query('SELECT id FROM platform_knowledge.sources WHERE id=ANY($1::uuid[])',[[one.id,restricted.id]])).rowCount,2);
  assert.equal((await db.query('SELECT platform_knowledge.source_visible(s) AS readable FROM platform_knowledge.sources s WHERE id=$1',[restricted.id])).rows[0].readable,false);
  assert.equal((await db.query('SELECT id FROM platform_knowledge.generations WHERE id=$1',[restricted.generation])).rowCount,0);
  await db.query("SELECT set_config('pk.user_id',$1,true),set_config('pk.operator','true',true)",[b]);
  assert.equal((await db.query('SELECT id FROM platform_knowledge.sources WHERE id=ANY($1::uuid[])',[[one.id,restricted.id]])).rowCount,0);
  await db.query("SELECT set_config('pk.user_id','',true)");assert.equal((await db.query('SELECT id FROM platform_knowledge.sources WHERE id=$1',[one.id])).rowCount,0);
 }finally{await db.query('ROLLBACK');db.release();}
});
test('a reclaimed job fences the previous worker and finite deadlines stop forever-running jobs',{skip:!uri,timeout:10000},async()=>{
 const setup=await pool.connect();let source,jobId=randomUUID();
 try{
  await setup.query('BEGIN; SET LOCAL ROLE platform_knowledge_owner');source=await fixture(setup,'33333333-3333-4333-8333-333333333333');
  await setup.query("INSERT INTO platform_knowledge.jobs(id,source_id,generation_id,kind,delegation) VALUES($1,$2,$3,'IMPORT','{}')",[jobId,source.id,source.generation]);await setup.query('COMMIT');
  const first=await claimJob(pool,'worker-a');assert.equal(first.id,jobId);
  await setup.query("UPDATE platform_knowledge.jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[jobId]);
  const second=await claimJob(pool,'worker-b');assert.equal(second.id,jobId);assert.equal(Number(second.fence),Number(first.fence)+1);
  await assert.rejects(withJob(pool,first,async()=>({late:true})),/JOB_LEASE_LOST/);
  assert.equal(await withJob(pool,second,async()=>true),true);
  await setup.query("UPDATE platform_knowledge.jobs SET deadline_at=clock_timestamp()-interval '1 second' WHERE id=$1",[jobId]);
  assert.equal(await claimJob(pool,'worker-c'),null);
  assert.equal((await setup.query('SELECT status FROM platform_knowledge.jobs WHERE id=$1',[jobId])).rows[0].status,'FAILED');
 }finally{
  // Synthetic fixture cleanup in the isolated test database, never Development.
  if(source){await setup.query('DELETE FROM platform_knowledge.jobs WHERE source_id=$1',[source.id]);await setup.query('DELETE FROM platform_knowledge.generations WHERE source_id=$1',[source.id]);await setup.query('DELETE FROM platform_knowledge.sources WHERE id=$1',[source.id]);}
  setup.release();
 }
});

test('native paid ledger prevents concurrent duplicate calls and settles spend after source revocation',{skip:!uri,timeout:10000},async()=>{
 const {createProvider}=await import('../src/provider.mjs');
 const user='44444444-4444-4444-8444-444444444444';
 let source;const db=await pool.connect();const apiUri=new URL(uri);apiUri.username='platform_knowledge_api';apiUri.password='';
 const api=new pg.Pool({connectionString:apiUri.href,max:3});
 try{
  await db.query('BEGIN;SET LOCAL ROLE platform_knowledge_owner');source=await fixture(db,user);await db.query('COMMIT');
  let calls=0,started,release;const began=new Promise(r=>started=r),wait=new Promise(r=>release=r);
  const provider=createProvider({pool:api,apiKey:'SYNTHETIC_ONLY',authorize:async()=>true,fetchImpl:async()=>{
   calls++;started();await wait;return Response.json({usage:{prompt_tokens:2,total_tokens:2},data:[{index:0,embedding:Array(1536).fill(0.1)}]});
  }});
  const command={sourceId:source.id,generationId:source.generation,texts:['synthetic test'],key:'one-call',scope:{principal:principal(user)}};
  const first=provider.embed(command);first.catch(()=>{});await Promise.race([began,first]);
  await assert.rejects(provider.embed(command),/PAID_RESULT_UNKNOWN/);assert.equal(calls,1);
  await db.query('UPDATE platform_knowledge.sources SET revoked_at=clock_timestamp() WHERE id=$1',[source.id]);release();
  await assert.rejects(first,/SOURCE_REVOKED/);
  const row=(await db.query('SELECT state,result,spent_microusd,reserved_by FROM platform_knowledge.provider_calls WHERE source_id=$1',[source.id])).rows[0];
  assert.equal(row.state,'SUCCEEDED');assert.equal(row.result,null);assert.equal(row.reserved_by,'platform_knowledge_api');assert.ok(Number(row.spent_microusd)>0);
 }finally{
  if(source){await db.query('DELETE FROM platform_knowledge.provider_calls WHERE source_id=$1',[source.id]);await db.query('DELETE FROM platform_knowledge.generations WHERE source_id=$1',[source.id]);await db.query('DELETE FROM platform_knowledge.sources WHERE id=$1',[source.id]);}
  db.release();await api.end();
 }
});
test('uncertain paid outcome retains one reservation and never resends on retry',{skip:!uri,timeout:10000},async()=>{
 const {createProvider}=await import('../src/provider.mjs');let source,calls=0;const db=await pool.connect();
 const apiUri=new URL(uri);apiUri.username='platform_knowledge_api';apiUri.password='';const api=new pg.Pool({connectionString:apiUri.href});
 try{
  await db.query('BEGIN;SET LOCAL ROLE platform_knowledge_owner');source=await fixture(db,'55555555-5555-4555-8555-555555555555');await db.query('COMMIT');
  const provider=createProvider({pool:api,apiKey:'SYNTHETIC_ONLY',authorize:async()=>true,fetchImpl:async()=>{calls++;throw Error('SYNTHETIC_NETWORK_LOSS');}});
  const command={sourceId:source.id,generationId:source.generation,texts:['synthetic uncertain'],key:'unknown',scope:{principal:principal('55555555-5555-4555-8555-555555555555')}};
  await assert.rejects(provider.embed(command),/PAID_RESULT_UNKNOWN/);await assert.rejects(provider.embed(command),/PAID_RESULT_UNKNOWN/);assert.equal(calls,1);
  const rows=(await db.query('SELECT state,reserved_microusd FROM platform_knowledge.provider_calls WHERE source_id=$1',[source.id])).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].state,'UNKNOWN');assert.ok(Number(rows[0].reserved_microusd)>0);
 }finally{
  if(source){await db.query('DELETE FROM platform_knowledge.provider_calls WHERE source_id=$1',[source.id]);await db.query('DELETE FROM platform_knowledge.generations WHERE source_id=$1',[source.id]);await db.query('DELETE FROM platform_knowledge.sources WHERE id=$1',[source.id]);}db.release();await api.end();
 }
});
