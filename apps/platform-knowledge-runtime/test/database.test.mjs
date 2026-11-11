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
 let source;const db=await pool.connect();const apiUri=new URL(uri);apiUri.username='platform_knowledge_api';apiUri.password=new URL(uri).password;
 const api=new pg.Pool({connectionString:apiUri.href,max:3});
 try{
  await db.query('BEGIN;SET LOCAL ROLE platform_knowledge_owner');source=await fixture(db,user);await db.query('COMMIT');
  let calls=0,started,release;const began=new Promise(r=>started=r),wait=new Promise(r=>release=r);
  const provider=createProvider({pool:api,apiKey:'SYNTHETIC_ONLY',authorize:async()=>true,fetchImpl:async()=>{
   calls++;started();await wait;return Response.json({usage:{prompt_tokens:2,total_tokens:2},data:[{index:0,embedding:Array(1536).fill(0.1)}]});
  }});
  const command={sourceId:source.id,generationId:null,query:true,texts:['synthetic test'],key:'one-call',scope:{principal:principal(user)}};
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
 const apiUri=new URL(uri);apiUri.username='platform_knowledge_api';apiUri.password=new URL(uri).password;const api=new pg.Pool({connectionString:apiUri.href});
 try{
  await db.query('BEGIN;SET LOCAL ROLE platform_knowledge_owner');source=await fixture(db,'55555555-5555-4555-8555-555555555555');await db.query('COMMIT');
  const provider=createProvider({pool:api,apiKey:'SYNTHETIC_ONLY',authorize:async()=>true,fetchImpl:async()=>{calls++;throw Error('SYNTHETIC_NETWORK_LOSS');}});
  const command={sourceId:source.id,generationId:null,query:true,texts:['synthetic uncertain'],key:'unknown',scope:{principal:principal('55555555-5555-4555-8555-555555555555')}};
  await assert.rejects(provider.embed(command),/PAID_RESULT_UNKNOWN/);await assert.rejects(provider.embed(command),/PAID_RESULT_UNKNOWN/);assert.equal(calls,1);
  const rows=(await db.query('SELECT state,reserved_microusd FROM platform_knowledge.provider_calls WHERE source_id=$1',[source.id])).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].state,'UNKNOWN');assert.ok(Number(rows[0].reserved_microusd)>0);
 }finally{
  if(source){await db.query('DELETE FROM platform_knowledge.provider_calls WHERE source_id=$1',[source.id]);await db.query('DELETE FROM platform_knowledge.generations WHERE source_id=$1',[source.id]);await db.query('DELETE FROM platform_knowledge.sources WHERE id=$1',[source.id]);}db.release();await api.end();
 }
});

test('shadow rebuild uses retained text after raw deletion; failed generation preserves active retrieval; delete purges derivatives',{skip:!uri,timeout:10000},async()=>{
 const {createLibrary}=await import('../src/admin.mjs'),{runRetention}=await import('../src/retention.mjs');
 const db=await pool.connect(),user='66666666-6666-4666-8666-666666666666';let source;
 const apiUri=new URL(uri);apiUri.username='platform_knowledge_api';const api=new pg.Pool({connectionString:apiUri.href});
 try{
  await db.query('BEGIN;SET LOCAL ROLE platform_knowledge_owner');source=await fixture(db,user);
  const text='Delivery takes 12 days after approval by Commission A.',chunkId=randomUUID();
  await db.query("UPDATE platform_knowledge.generations SET parser_version='pk-passive-inventory-v1',state='ACTIVE',source_digest=$2,character_count=$3,chunk_count=1,inventory=$4,coverage=$5,validation=$6 WHERE id=$1",[
   source.generation,digest(text),text.length,JSON.stringify({nativeUnits:1,units:[{id:'p1',kind:'PAGE',ordinal:1,start:0,end:text.length,status:'COMPLETE'}]}),JSON.stringify({expectedUnits:1,accountedUnits:1,extractedCharacters:text.length,chunkedCharacters:text.length,completeUnits:1,failedUnitIds:[]}),JSON.stringify({quality:'COMPLETE'})]);
  await db.query(`INSERT INTO platform_knowledge.chunks(id,generation_id,ordinal,start_offset,end_offset,text_content,sha256,token_count,locations,embedding)
   VALUES($1,$2,0,0,$3,$4,$5,12,$6,$7::public.vector)`,[chunkId,source.generation,text.length,text,digest(text),JSON.stringify([{unitId:'p1',kind:'PAGE',ordinal:1,start:0,end:text.length}]),JSON.stringify(Array(1536).fill(0.1))]);
  await db.query('UPDATE platform_knowledge.sources SET active_generation_id=$2,raw_deleted_at=clock_timestamp() WHERE id=$1',[source.id,source.generation]);await db.query('COMMIT');
  const next=randomUUID(),jobId=randomUUID(),delegation={sourceId:source.id,generationId:next,jobId,rightsDigest:digest(rights)};
  const scope={principal:principal(user),delegation};const library=createLibrary({pool:api,storage:{remove:async()=>{}},createDelegation:async()=>delegation});
  const result=await library.reindex(source.id,scope);assert.equal(result.activeGenerationId,source.generation);
  const copied=(await db.query('SELECT id,text_content FROM platform_knowledge.chunks WHERE generation_id=$1',[next])).rows;
  assert.equal(copied.length,1);assert.equal(copied[0].text_content,text);assert.notEqual(copied[0].id,chunkId);
  await db.query("UPDATE platform_knowledge.jobs SET status='FAILED',error_code='SYNTHETIC_INVALID_REBUILD' WHERE id=$1",[jobId]);
  assert.equal((await db.query('SELECT active_generation_id FROM platform_knowledge.sources WHERE id=$1',[source.id])).rows[0].active_generation_id,source.generation);
  assert.equal((await library.get(source.id,scope)).status,'CURRENT');
  await library.revoke(source.id,false,scope);assert.equal((await library.get(source.id,scope)).cognitive_result.length,0);
  await transaction(api,async c=>assert.equal((await c.query('SELECT id FROM platform_knowledge.chunks WHERE generation_id=$1',[source.generation])).rowCount,0),scope.principal);
  await library.revoke(source.id,true,scope);await runRetention({pool,storage:{remove:async()=>{}}});
  assert.equal((await db.query('SELECT id FROM platform_knowledge.chunks WHERE generation_id=ANY($1::uuid[])',[[source.generation,next]])).rowCount,0);
  assert.equal((await db.query('SELECT active_generation_id FROM platform_knowledge.sources WHERE id=$1',[source.id])).rows[0].active_generation_id,null);
 }finally{
  if(source){await db.query('DELETE FROM platform_knowledge.jobs WHERE source_id=$1',[source.id]);await db.query('UPDATE platform_knowledge.sources SET active_generation_id=NULL WHERE id=$1',[source.id]);await db.query('DELETE FROM platform_knowledge.chunks WHERE generation_id IN(SELECT id FROM platform_knowledge.generations WHERE source_id=$1)',[source.id]);await db.query('DELETE FROM platform_knowledge.generations WHERE source_id=$1',[source.id]);await db.query('DELETE FROM platform_knowledge.sources WHERE id=$1',[source.id]);}db.release();await api.end();
 }
});

test('private query caches on a shared document stay user-scoped; its cost cap counts every user',{skip:!uri,timeout:10000},async()=>{
 const {createProvider}=await import('../src/provider.mjs');const db=await pool.connect();let source;
 const user='77777777-7777-4777-8777-777777777777',other='88888888-8888-4888-8888-888888888888';
 const apiUri=new URL(uri);apiUri.username='platform_knowledge_api';const api=new pg.Pool({connectionString:apiUri.href});
 try{
  await db.query('BEGIN;SET LOCAL ROLE platform_knowledge_owner');source=await fixture(db,user);
  await db.query("UPDATE platform_knowledge.sources SET scope='PROFITIA_SHARED',owner_user_id=NULL,published_at=clock_timestamp(),rights=$2 WHERE id=$1",[source.id,JSON.stringify({...rights,classification:'PUBLIC',purpose:'CUSTOMER_SERVICE'})]);
  await db.query(`INSERT INTO platform_knowledge.provider_calls(id,source_id,call_key,stage_key,kind,model,state,reserved_microusd,spent_microusd,request_owner_user_id,reserved_by,result)
   VALUES($1,$2,$3,'synthetic-private-query','COGNITIVE','gpt-6-luna','SUCCEEDED',1000000,1000000,$4,'platform_knowledge_api',$5)`,[randomUUID(),source.id,'d'.repeat(64),user,JSON.stringify({private:'SYNTHETIC_USER_A_ONLY'})]);
  await db.query('UPDATE platform_knowledge.budget SET spent_microusd=spent_microusd+1000000 WHERE id=true');await db.query('COMMIT');
  const p=id=>({...principal(id),allowedScopes:['PROFITIA_SHARED'],sharedKnowledgeAllowed:true});
  await transaction(api,async c=>assert.equal((await c.query('SELECT result FROM platform_knowledge.provider_calls WHERE source_id=$1',[source.id])).rowCount,1),p(user));
  await transaction(api,async c=>assert.equal((await c.query('SELECT result FROM platform_knowledge.provider_calls WHERE source_id=$1',[source.id])).rowCount,0),p(other));
  let calls=0;const provider=createProvider({pool:api,apiKey:'SYNTHETIC_ONLY',authorize:async()=>true,fetchImpl:async()=>{calls++;throw Error('MUST_NOT_SEND');}});
  await assert.rejects(provider.embed({sourceId:source.id,texts:['query by user B'],query:true,key:'global-document-cap',scope:{principal:p(other)}}),/BUDGET_EXCEEDED/);assert.equal(calls,0);
  await assert.rejects(transaction(api,c=>c.query('UPDATE platform_knowledge.budget SET spent_microusd=0'),p(other)),/permission denied/);
 }finally{
  if(source){await db.query('DELETE FROM platform_knowledge.provider_calls WHERE source_id=$1',[source.id]);await db.query('DELETE FROM platform_knowledge.generations WHERE source_id=$1',[source.id]);await db.query('DELETE FROM platform_knowledge.sources WHERE id=$1',[source.id]);}db.release();await api.end();
 }
});

test('import retry returns its original source and rejects a changed payload without another upload',{skip:!uri,timeout:10000},async()=>{
 const {createLibrary}=await import('../src/admin.mjs');const user='99999999-9999-4999-8999-999999999999';
 const apiUri=new URL(uri);apiUri.username='platform_knowledge_api';const api=new pg.Pool({connectionString:apiUri.href});let sourceId;
 try{
  let puts=0;const library=createLibrary({pool:api,storage:{put:async()=>{puts++;},remove:async()=>{}},createDelegation:async(scope)=>scope.delegation});
  const bytes=Buffer.from('A synthetic complete upload.');const input={version:'0.2.0',requestId:randomUUID(),scope:'ACCOUNT_PRIVATE',fileName:'retry.txt',mediaType:'text/plain',sizeBytes:bytes.length,sha256:digest(bytes),memoryRequested:false,rights};
  const scope=()=>({principal:principal(user),delegation:{sourceId:randomUUID(),generationId:randomUUID(),jobId:randomUUID(),rightsDigest:digest(rights)}});
  const first=await library.import(input,bytes,scope());sourceId=first.sourceId;
  const second=await library.import(input,bytes,scope());assert.equal(second.sourceId,first.sourceId);assert.equal(second.status,'ALREADY_ACCEPTED');assert.equal(puts,1);
  await assert.rejects(library.import({...input,rights:{...rights,quotingAllowed:false}},bytes,scope()),/IMPORT_REQUEST_CONFLICT/);assert.equal(puts,1);
  const db=await pool.connect();try{assert.equal((await db.query('SELECT id FROM platform_knowledge.jobs WHERE source_id=$1',[sourceId])).rowCount,1);}finally{db.release();}
 }finally{
  if(sourceId){await pool.query('DELETE FROM platform_knowledge.jobs WHERE source_id=$1',[sourceId]);await pool.query('DELETE FROM platform_knowledge.generations WHERE source_id=$1',[sourceId]);await pool.query('DELETE FROM platform_knowledge.sources WHERE id=$1',[sourceId]);}await api.end();
 }
});

test('retained normalized source traverses cognition, embeddings, verification and atomic activation with synthetic provider',{skip:!uri,timeout:10000},async()=>{
 const {createProvider}=await import('../src/provider.mjs'),{processJob}=await import('../src/processing.mjs');
 const user='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',db=await pool.connect();let source;
 const workerUri=new URL(uri);workerUri.username='platform_knowledge_worker';const worker=new pg.Pool({connectionString:workerUri.href});
 try{
  await db.query('BEGIN;SET LOCAL ROLE platform_knowledge_owner');source=await fixture(db,user);
  const text='Delivery takes 12 days after approval by Commission A.',chunkId=randomUUID(),jobId=randomUUID();
  await db.query('UPDATE platform_knowledge.generations SET source_digest=$2,inventory=$3,coverage=$4,character_count=$5,chunk_count=1 WHERE id=$1',[
   source.generation,digest(text),JSON.stringify({nativeUnits:1,sourceInventoryVerified:true,units:[{id:'p1',kind:'PAGE',ordinal:1,start:0,end:text.length,status:'COMPLETE'}]}),JSON.stringify({expectedUnits:1,accountedUnits:1,completeUnits:1,failedUnitIds:[],extractedCharacters:text.length,chunkedCharacters:text.length}),text.length]);
  await db.query(`INSERT INTO platform_knowledge.chunks(id,generation_id,ordinal,start_offset,end_offset,text_content,sha256,token_count,locations)
   VALUES($1,$2,0,0,$3,$4,$5,12,$6)`,[chunkId,source.generation,text.length,text,digest(text),JSON.stringify([{unitId:'p1',kind:'PAGE',ordinal:1,start:0,end:text.length}])]);
  await db.query("INSERT INTO platform_knowledge.jobs(id,source_id,generation_id,kind,delegation) VALUES($1,$2,$3,'REINDEX',$4)",[jobId,source.id,source.generation,JSON.stringify({rightsDigest:digest(rights)})]);await db.query('COMMIT');
  let paid=0;const provider=createProvider({pool:worker,apiKey:'SYNTHETIC_ONLY',authorize:async()=>true,fetchImpl:async(url,init)=>{
   if(url.endsWith('/input_tokens'))return Response.json({input_tokens:100});paid++;
   if(url.endsWith('/embeddings'))return Response.json({usage:{prompt_tokens:12},data:[{index:0,embedding:Array(1536).fill(0.1)}]});
   const body=JSON.parse(init.body),input=JSON.parse(body.input),first=input.untrustedSource[0];
   return Response.json({id:'synthetic-response',status:'completed',usage:{input_tokens:100,output_tokens:50},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({summary:text,statements:[{kind:'SOURCE_STATEMENT',claim:'Delivery and approval conditions',chunkId:first.chunkId,quote:first.text}],terms:['delivery'],uncertainties:[]})}]}]});
  }});
  const job=await claimJob(worker,'synthetic-pipeline');assert.equal(job.id,jobId);
  await processJob({pool:worker,provider,job,storage:{remove:async()=>{}},authorizeJob:async()=>({principal:principal(user)})});
  assert.equal(paid,2);assert.equal((await db.query('SELECT status FROM platform_knowledge.jobs WHERE id=$1',[jobId])).rows[0].status,'READY');
  assert.equal((await db.query('SELECT active_generation_id FROM platform_knowledge.sources WHERE id=$1',[source.id])).rows[0].active_generation_id,source.generation);
  const generation=(await db.query('SELECT state,validation FROM platform_knowledge.generations WHERE id=$1',[source.generation])).rows[0];assert.equal(generation.state,'ACTIVE');assert.equal(generation.validation.roundTrip,true);
  assert.equal((await db.query('SELECT ordinal FROM platform_knowledge.cognition WHERE generation_id=$1',[source.generation])).rowCount,2);
 }finally{
  if(source){await db.query('UPDATE platform_knowledge.sources SET active_generation_id=NULL WHERE id=$1',[source.id]);await db.query('DELETE FROM platform_knowledge.jobs WHERE source_id=$1',[source.id]);await db.query('DELETE FROM platform_knowledge.provider_calls WHERE source_id=$1',[source.id]);await db.query('DELETE FROM platform_knowledge.cognition WHERE generation_id=$1',[source.generation]);await db.query('DELETE FROM platform_knowledge.chunks WHERE generation_id=$1',[source.generation]);await db.query('DELETE FROM platform_knowledge.generations WHERE source_id=$1',[source.id]);await db.query('DELETE FROM platform_knowledge.sources WHERE id=$1',[source.id]);}db.release();await worker.end();
 }
});

test('all contributing sources fence a cached query and token counting after secondary-source withdrawal',{skip:!uri,timeout:10000},async()=>{
 const {createProvider}=await import('../src/provider.mjs'),{runRetention}=await import('../src/retention.mjs');
 const user='bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb',db=await pool.connect();let one,two;
 const apiUri=new URL(uri);apiUri.username='platform_knowledge_api';const api=new pg.Pool({connectionString:apiUri.href});
 try{
  await db.query('BEGIN;SET LOCAL ROLE platform_knowledge_owner');one=await fixture(db,user);two=await fixture(db,user);await db.query('COMMIT');
  let calls=0;const provider=createProvider({pool:api,apiKey:'SYNTHETIC_ONLY',authorize:async()=>true,fetchImpl:async(url)=>{
   calls++;if(url.endsWith('/input_tokens'))return Response.json({input_tokens:20});
   return Response.json({id:'synthetic-lineage',status:'completed',usage:{input_tokens:20,output_tokens:10},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({summary:'Synthetic only',statements:[],terms:[],uncertainties:[]})}]}]});
  }});
  const command={sourceId:one.id,generationId:null,chunks:[{id:randomUUID(),text:'Synthetic knowledge.'}],sourceRefs:[{sourceId:one.id},{sourceId:two.id}],key:'lineage',scope:{principal:principal(user)}};
  await provider.analyze(command);assert.equal(calls,2);
  await transaction(api,async c=>assert.equal((await c.query('SELECT result FROM platform_knowledge.provider_calls WHERE source_id=$1',[one.id])).rowCount,1),principal(user));
  await db.query('UPDATE platform_knowledge.sources SET revoked_at=clock_timestamp() WHERE id=$1',[two.id]);
  await transaction(api,async c=>assert.equal((await c.query('SELECT result FROM platform_knowledge.provider_calls WHERE source_id=$1',[one.id])).rowCount,0),principal(user));
  await assert.rejects(provider.analyze(command),/RIGHTS_DENIED/);assert.equal(calls,2);
  await runRetention({pool,storage:{remove:async()=>{}}});
  const row=(await db.query('SELECT result,state,spent_microusd FROM platform_knowledge.provider_calls WHERE source_id=$1',[one.id])).rows[0];
  assert.equal(row.result,null);assert.equal(row.state,'SUCCEEDED');assert.ok(Number(row.spent_microusd)>0);
 }finally{
  for(const source of [one,two].filter(Boolean)){await db.query('DELETE FROM platform_knowledge.provider_calls WHERE source_id=$1',[source.id]);await db.query('DELETE FROM platform_knowledge.generations WHERE source_id=$1',[source.id]);await db.query('DELETE FROM platform_knowledge.sources WHERE id=$1',[source.id]);}db.release();await api.end();
 }
});
