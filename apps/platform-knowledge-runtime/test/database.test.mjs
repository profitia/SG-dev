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
test('actual PostgreSQL RLS isolates private users, org admin, missing context and retained organisation restrictions',{skip:!uri},async()=>{
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 const db=await pool.connect();try{
  await db.query('BEGIN; SET LOCAL ROLE platform_knowledge_owner');const one=await fixture(db,a),restricted=await fixture(db,a,{organisationConstraintId:'org-old'});
  await db.query('SET LOCAL ROLE platform_knowledge_api');
  await db.query("SELECT set_config('pk.user_id',$1,true),set_config('pk.organisation_ids','[]',true),set_config('pk.allowed_scopes','[\"ACCOUNT_PRIVATE\"]',true),set_config('pk.operator','false',true),set_config('pk.purpose','CUSTOMER_SERVICE',true)",[a]);
  assert.deepEqual((await db.query('SELECT id FROM platform_knowledge.sources WHERE id=ANY($1::uuid[]) ORDER BY id',[[one.id,restricted.id]])).rows.map(r=>r.id),[one.id]);
  await db.query("SELECT set_config('pk.user_id',$1,true),set_config('pk.operator','true',true)",[b]);
  assert.equal((await db.query('SELECT id FROM platform_knowledge.sources WHERE id=ANY($1::uuid[])',[[one.id,restricted.id]])).rowCount,0);
  await db.query("SELECT set_config('pk.user_id','',true)");assert.equal((await db.query('SELECT id FROM platform_knowledge.sources WHERE id=$1',[one.id])).rowCount,0);
 }finally{await db.query('ROLLBACK');db.release();}
});
test('a reclaimed job fences the previous worker and finite deadlines stop forever-running jobs',{skip:!uri},async()=>{
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
