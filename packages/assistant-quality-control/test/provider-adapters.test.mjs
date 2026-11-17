import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import {spawnSync} from 'node:child_process'
import {randomUUID,randomBytes,createHash,createHmac} from 'node:crypto'
import pg from 'pg'
import {createQualityBudget,quoteCodeRequest,readCodeUsage} from '../src/budget.mjs'
import {createQualityStore} from '../src/store.mjs'
import {advanceIncident,createQualityController} from '../src/controller.mjs'

const hash=s=>createHash('sha256').update(s).digest('hex')
const sqlSource=name=>fs.readFileSync(new URL('../../../apps/package-limits/migrations/'+name,import.meta.url),'utf8')
const check=(command,args)=>{
 const r=spawnSync(command,args,{encoding:'utf8',timeout:60000})
 if(r.error||r.status!==0)throw Error('Isolated PostgreSQL fixture command failed: '+command+' '+(r.error?.code??r.stderr?.slice(-1000)))
 return r.stdout.trim()
}
async function isolatedPostgres(){
 // A new, task-owned cluster only. No URL, secret or existing cloud database
 // is accepted by this fixture. PostgreSQL binaries must already be installed.
 const bin=process.env.AQC_TEST_POSTGRES_BIN??check('pg_config',['--bindir']);assert(path.isAbsolute(bin)&&path.resolve(bin)===bin)
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aqc-pg-fixture-'))
 const data=path.join(root,'data'),sock=path.join(root,'socket');fs.mkdirSync(sock)
 const probe=net.createServer();await new Promise((resolve,reject)=>probe.once('error',reject).listen(0,'127.0.0.1',resolve))
 const port=probe.address().port;await new Promise(resolve=>probe.close(resolve))
 let started=false
 try{
  check(path.join(bin,'initdb'),['-D',data,'-U','aqc_fixture_owner','--auth-local=trust','--auth-host=trust','--encoding=UTF8','--no-locale'])
  check(path.join(bin,'pg_ctl'),['-D',data,'-l',path.join(root,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -k ${sock}`,'-w','start']);started=true
  const url=new URL(`postgresql://aqc_fixture_owner@127.0.0.1:${port}/postgres`)
  const admin=new pg.Pool({connectionString:url.toString()});await admin.query('CREATE DATABASE neondb');await admin.end();url.pathname='/neondb'
  const pools=[]
  const pool=role=>{const u=new URL(url);u.username=role;const p=new pg.Pool({connectionString:u.toString(),max:role==='aqc_fixture_owner'?1:8});pools.push(p);return p}
  return {pool,async close(){await Promise.all(pools.map(p=>p.end()));check(path.join(bin,'pg_ctl'),['-D',data,'-w','stop','-m','fast']);started=false;fs.rmSync(root,{recursive:true,force:true})}}
 }catch(error){if(started)check(path.join(bin,'pg_ctl'),['-D',data,'-w','stop','-m','fast']);fs.rmSync(root,{recursive:true,force:true});throw error}
}

test('Native Package & Limits: concurrent holds, durable unknown costs, exact roles and irreversible pilot clock',async()=>{
 const fixture=await isolatedPostgres()
 try{
  const owner=fixture.pool('aqc_fixture_owner'),roles=['controller','broker','capture'],serviceId=randomUUID(),account=randomUUID(),org=randomUUID()
  const one=sqlSource('001-limits.sql'),four=sqlSource('004-assistant-usage.sql'),five=sqlSource('005-assistant-quality-usage.sql'),schemaDigest=hash(five)
  await owner.query('CREATE EXTENSION pgcrypto; CREATE ROLE profitia_limits_owner NOLOGIN NOINHERIT; CREATE ROLE profitia_limits_assistant_runtime LOGIN NOINHERIT; CREATE ROLE profitia_limits_runtime LOGIN NOINHERIT;')
  for(const r of roles)await owner.query('CREATE ROLE profitia_limits_quality_'+r+' LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS')
  // The cluster administrator grants only the owner the schema creation right.
  await owner.query('GRANT CREATE ON DATABASE neondb TO profitia_limits_owner')
  await owner.query('BEGIN; SET LOCAL ROLE profitia_limits_owner;')
  await owner.query(one.replaceAll('__LIMITS_SCHEMA_DIGEST__',hash(one)))
  await owner.query(four.replaceAll('__ASSISTANT_USAGE_SCHEMA_DIGEST__',hash(four)))
  await owner.query(five.replaceAll('__QUALITY_USAGE_SCHEMA_DIGEST__',schemaDigest));await owner.query('COMMIT')
  await owner.query(`INSERT INTO profitia_limits.quality_installation(singleton,schema_digest,service_id,enabled,gate_set_sha256,authorised_until,test_account_id,test_organisation_id,source_ref)
   VALUES(true,$1,$2,true,'${'c'.repeat(64)}',clock_timestamp()+interval '30 days',$3,$4,'synthetic isolated fixture only')`,[schemaDigest,serviceId,account,org])
  const clients={},keys={},pools={}
  for(const role of roles){
   const name='profitia_limits_quality_'+role,key=randomBytes(32).toString('hex');keys[role]=key;pools[role]=fixture.pool(name)
   await owner.query('INSERT INTO profitia_limits.quality_credentials VALUES($1,$2,decode($3,\'hex\'))',[name,serviceId,key])
   clients[role]=createQualityBudget({query:(q,p)=>pools[role].query(q,p),commandKey:key,schemaDigest,serviceId,role:name})
  }
  for(const role of roles){
   await assert.rejects(pools[role].query('SELECT * FROM profitia_limits.quality_credentials'),e=>e.code==='42501')
   await assert.rejects(pools[role].query('SET ROLE profitia_limits_owner'),e=>e.code==='42501')
  }
  const hold=id=>clients.controller.ensureIncident(id,{repairClass:'C1',causeFingerprint:hash(id),acceptanceRequired:true})
  const ids=Array.from({length:11},()=>randomUUID()),holds=await Promise.allSettled(ids.map(hold))
  assert.equal(holds.filter(r=>r.status==='fulfilled').length,10);assert.equal(holds.filter(r=>r.status==='rejected'&&r.reason.code==='LIMIT_EXCEEDED').length,1)
  const id=ids[holds.findIndex(r=>r.status==='fulfilled')]
  assert.equal((await clients.controller.status()).committedNanoUsd,'50000000000')
  assert.equal((await clients.controller.status()).pilotStartedAt,null,'holding never starts or resets the pilot')
  await hold(id)
  await assert.rejects(clients.controller.ensureIncident(randomUUID(),{repairClass:'C1',causeFingerprint:hash(id),acceptanceRequired:true}),{code:'IDEMPOTENCY_CONFLICT'})
  const attemptId=randomUUID(),expiresAt=new Date(Date.now()+29*60000).toISOString()
  const permit=await clients.controller.openAttempt(id,{attemptId,ordinal:1,expiresAt})
  const binding={runId:'123',runAttempt:1,executorSourceSha:'b'.repeat(40),gateSetSha256:'c'.repeat(64),nonce:randomUUID()}
  await assert.rejects(clients.broker.assertPermit(permit),{code:'POLICY_UNAVAILABLE'})
  await clients.broker.claimExecutor(permit,binding)
  await assert.rejects(clients.broker.claimExecutor(permit,binding),{code:'IDEMPOTENCY_CONFLICT'})
  const otherId=ids.find((v,i)=>v!==id&&holds[i].status==='fulfilled')
  await assert.rejects(clients.controller.openAttempt(otherId,{attemptId:randomUUID(),ordinal:1,expiresAt}),{code:'IDEMPOTENCY_CONFLICT'})
  const request={requestId:randomUUID(),inputDigest:hash('no prompt stored'),quote:quoteCodeRequest(200000)}
  const reserved=await clients.broker.reserveRequest(permit,request)
  assert.equal((await clients.broker.reserveRequest(permit,request)).status,'REPLAY')
  await clients.broker.dispatchRequest(reserved)
  await assert.rejects(clients.broker.dispatchRequest(reserved),{code:'IDEMPOTENCY_CONFLICT'})
  const clock=(await clients.controller.status()).pilotStartedAt;assert(clock)
  await clients.broker.markUnknown(reserved,'CANCELLED')
  await assert.rejects(clients.broker.releaseUndispatched(reserved),{code:'IDEMPOTENCY_CONFLICT'})
  const more=[]
  for(let j=0;j<2;j++)more.push(await clients.broker.reserveRequest(permit,{...request,requestId:randomUUID(),inputDigest:hash('bound-'+j)}))
  await assert.rejects(clients.broker.reserveRequest(permit,{...request,requestId:randomUUID(),inputDigest:hash('over incident bound')}),{code:'LIMIT_EXCEEDED'})
  for(const unspent of more)await clients.broker.releaseUndispatched(unspent)
  const db=(await owner.query('SELECT status,maximum_nano_usd::text FROM profitia_limits.quality_requests WHERE request_id=$1',[request.requestId])).rows[0]
  assert.equal(db.status,'PENDING_RECONCILIATION');assert.equal(db.maximum_nano_usd,request.quote.maximumNanoUsd)
  await clients.controller.closeAttempt(id,{attemptId,stoppedProofSha256:hash('independent termination proof')})
  const next=await clients.controller.openAttempt(id,{attemptId:randomUUID(),ordinal:2,expiresAt})
  await clients.broker.claimExecutor(next,{...binding,runId:'124',nonce:randomUUID()})
  const q2=await clients.broker.reserveRequest(next,{requestId:randomUUID(),inputDigest:hash('second'),quote:quoteCodeRequest(10,20)})
  await clients.broker.dispatchRequest(q2)
  const usage=readCodeUsage({input_tokens:10,output_tokens:20,total_tokens:30,input_tokens_details:{cached_tokens:2,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:5}},
   {model:'gpt-6.1-sol',serviceTier:'default',quote:q2.quote})
  await clients.broker.settleRequest(q2,usage);await clients.broker.settleRequest(q2,usage)
  await assert.rejects(clients.broker.settleRequest(q2,{...usage,nanoUsd:'1'}),{code:'IDEMPOTENCY_CONFLICT'})
  await clients.controller.closeAttempt(id,{attemptId:next.attemptId,stoppedProofSha256:hash('stopped2')})
  await assert.rejects(clients.controller.openAttempt(id,{attemptId:randomUUID(),ordinal:2,expiresAt}),{code:'ATTEMPTS_EXHAUSTED'})
  await clients.controller.closeIncident(id)
  const committed=BigInt((await clients.controller.status()).committedNanoUsd)
  assert.equal(committed,45000000000n+BigInt(request.quote.maximumNanoUsd)+BigInt(usage.nanoUsd),'closed unknown retains its full bound')
  assert.equal((await clients.controller.status()).pilotStartedAt,clock)
  // QA acceptance supplements the original product reservation. It does not
  // mint a HUMAN execution or replace the existing product limit/identity.
  const assignment=randomUUID(),policy=randomUUID()
  await owner.query(`INSERT INTO profitia_limits.assignments(id,organisation_id,product_id,revision,active_from,active_until,payload)
   VALUES($1,$2,'SPENDGURU',1,clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 day','{}')`,[assignment,org])
  await owner.query(`INSERT INTO profitia_limits.assistant_policy(singleton,policy_id,actor_id,organisation_id,assignment_id,assignment_revision,enabled,source_ref)
   VALUES(true,$1,$2,$3,$4,1,true,'synthetic local only')`,[policy,account,org,assignment])
  const execution=async(actor=account)=>{
   const eid=randomUUID();await owner.query(`INSERT INTO profitia_limits.assistant_executions(execution_id,actor_id,organisation_id,command_id,decision_id,policy_id,policy_version,assignment_id,assignment_revision,
    model,pricing_version,input_digest,input_bound,output_bound,reserved_nano_usd,status,dispatch_before)
    VALUES($1,$2,$3,$4,$5,$6,1,$7,1,'gpt-5.6-luna','openai-gpt-5.6-luna-standard-20261109',$8,100000,2048,52457600,'RESERVED',clock_timestamp()+interval '20 seconds')`,
    [eid,actor,org,randomUUID(),randomUUID(),policy,assignment,hash(eid)]);return eid
  }
  const eid=await execution();const captured=await clients.capture.reserveAssistant(otherId,eid)
  assert.equal(captured.executionId,eid);assert.equal(captured.status,'DISPATCHED')
  assert.equal((await clients.capture.reserveAssistant(otherId,eid)).status,'REPLAY')
  const foreign=await execution(randomUUID());await assert.rejects(clients.capture.reserveAssistant(otherId,foreign),{code:'POLICY_UNAVAILABLE'})
  assert.equal((await clients.capture.reconcileAssistant(otherId,eid)).status,'PENDING_RECONCILIATION')
  await owner.query(`UPDATE profitia_limits.assistant_executions SET status='SETTLED',usage='{"nanoUsd":"12345"}' WHERE execution_id=$1`,[eid])
  assert.equal((await clients.capture.reconcileAssistant(otherId,eid)).status,'SETTLED')
  await clients.controller.closeIncident(otherId)
  assert.equal(BigInt((await clients.controller.status()).committedNanoUsd),committed-5000000000n+12345n)
  assert.equal((await clients.controller.status()).pilotStartedAt,clock)
  // Broker credentials cannot open/close incidents or fabricate provider costs.
  const body=JSON.stringify({contract:'QualityUsage/1.0.0',action:'CLOSE_INCIDENT',incidentId:otherId,serviceId,schemaDigest,until:Date.now()+9000})
  const proof=createHmac('sha256',Buffer.from(keys.broker,'hex')).update(body).digest('hex')
  await assert.rejects(pools.broker.query('SELECT profitia_limits.quality_usage($1,$2)',[body,proof]),e=>e.message==='POLICY_UNAVAILABLE')
  await owner.query('UPDATE profitia_limits.quality_installation SET enabled=false')
  await assert.rejects(hold(randomUUID()),{code:'LIMIT_EXCEEDED'})
  assert.equal((await clients.controller.status()).pilotStartedAt,clock)
  await assert.rejects(owner.query('DELETE FROM profitia_limits.quality_usage_events'),e=>e.message==='IMMUTABLE_HISTORY')
 }finally{await fixture.close()}
})

test('Native controller store: competing workers, restart reconciliation, stale leases and class suspension',async()=>{
 const fixture=await isolatedPostgres()
 try{
  const owner=fixture.pool('aqc_fixture_owner'),serviceId=randomUUID(),key=randomBytes(32).toString('hex')
  const history=fs.readFileSync(new URL('../../../apps/sg-runtime/migrations/assistant/001-history.sql',import.meta.url),'utf8')
  const source=fs.readFileSync(new URL('../migrations/001-control.sql',import.meta.url),'utf8'),digest=hash(source)
  await owner.query('CREATE EXTENSION pgcrypto; CREATE ROLE sg2_assistant_history_owner NOLOGIN NOINHERIT; CREATE ROLE sg2_assistant_history_runtime LOGIN NOINHERIT; CREATE ROLE sg2_assistant_quality_controller LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS; GRANT CREATE ON DATABASE neondb TO sg2_assistant_history_owner;')
  await owner.query('BEGIN; SET LOCAL ROLE sg2_assistant_history_owner;')
  await owner.query(history.replaceAll('__ASSISTANT_HISTORY_SCHEMA_DIGEST__',hash(history)))
  await owner.query(`INSERT INTO sg2_assistant_history.installation VALUES(true,$1,'development','spendguru','autumn-waterfall-65938876','br-dry-hall-b294222f',decode($2,'hex'),$3,'synthetic local only')`,[hash(history),key,randomUUID()])
  await owner.query(source.replaceAll('__QUALITY_CONTROL_SCHEMA_DIGEST__',digest));await owner.query('COMMIT')
  await owner.query(`INSERT INTO sg2_assistant_quality_control.installation VALUES(true,$1,$2,decode($3,'hex'),true,'synthetic local only')`,[digest,serviceId,key])
  const runtime=fixture.pool('sg2_assistant_quality_controller'),options={query:(q,p)=>runtime.query(q,p),commandKey:key,schemaDigest:digest,serviceId}
  const store=createQualityStore(options),other=createQualityStore(options),baseSha='a'.repeat(40),id=randomUUID()
  await assert.rejects(runtime.query('SELECT * FROM sg2_assistant_history.turns'),e=>e.code==='42501')
  await assert.rejects(runtime.query('SELECT * FROM sg2_assistant_quality_control.incidents'),e=>e.code==='42501')
  await assert.rejects(runtime.query('SET ROLE sg2_assistant_history_owner'),e=>e.code==='42501')
  await store.create({id,repairClass:'C1',causeFingerprint:hash(id),baseSha})
  const claims=await Promise.all([store.claim({id,workerId:'one',leaseMs:30000}),other.claim({id,workerId:'two',leaseMs:30000})])
  assert.equal(claims.filter(Boolean).length,1)
  let lease=claims.find(Boolean),record=lease.record
  const identity=()=>({id,leaseToken:lease.leaseToken,revision:record.revision})
  const prepare=async action=>{const result=await store.prepare({...identity(),action,nonce:randomUUID(),consumeAttempt:action==='EXECUTE',consumeRollback:action==='ROLLBACK',enforceReleaseWindow:action==='PROMOTE'});record=result.record;return result}
  const finish=async(action,result)=>{record=await store.complete({...identity(),nonce:record.pending.nonce,record:advanceIncident(record,action,result,Date.now())})}
  await prepare('QUALIFY');await finish('QUALIFY',{result:'DETERMINISTIC_FAILURE',method:'DETERMINISTIC',repairClass:'C1',causeFingerprint:hash(id)})
  await prepare('REPRODUCE');await finish('REPRODUCE',{result:'RED',baseSha,proofSha256:hash('red')})
  await prepare('EXECUTE');const nonce=record.pending.nonce;assert.equal(record.attemptsUsed,1)
  await store.release({id,leaseToken:lease.leaseToken})
  const otherId=randomUUID();await store.create({id:otherId,repairClass:'C2',causeFingerprint:hash(otherId),baseSha})
  assert.equal(await store.claim({id:otherId,workerId:'two',leaseMs:30000}),null,'pending intent holds the repository across restarts')
  const oldToken=lease.leaseToken;lease=await other.claim({id,workerId:'restart',leaseMs:30000});record=lease.record
  assert.equal(record.pending.nonce,nonce);assert.equal(record.attemptsUsed,1)
  await store.release({id,leaseToken:oldToken})
  assert.equal(await store.claim({id,workerId:'stale',leaseMs:30000}),null,'stale finally cannot release the replacement lease')
  await assert.rejects(store.recordExternal({id,leaseToken:oldToken,revision:record.revision,nonce,externalId:'123'}),{code:'LEASE_LOST'})
  record=await store.recordExternal({...identity(),nonce,externalId:'123'})
  await assert.rejects(store.complete({...identity(),nonce,record:{...record,pending:null,attemptsUsed:0}}),{code:'CONTROL_RECORD_INVALID'})
  await finish('EXECUTE',{result:'FAILED'});assert.equal(record.status,'REPRODUCED');assert.equal(record.attemptsUsed,1)
  await prepare('EXECUTE');await finish('EXECUTE',{result:'FAILED'});assert.equal(record.status,'NEEDS_TECHNICAL_REVIEW');assert.equal(record.attemptsUsed,2)
  const replay=await store.create({id:randomUUID(),repairClass:'C1',causeFingerprint:hash(id),baseSha})
  assert.equal(replay.id,id);assert.equal(replay.attemptsUsed,2,'deduplication cannot reset attempts or budget')
  await store.release({id,leaseToken:lease.leaseToken})
  assert.deepEqual(await store.listDue(),[otherId])
  // A full restart loses the dispatch HTTP response but not its committed
  // intent. The next controller consults the same nonce and never dispatches.
  let dispatched=0
  const actions={dispatch:async()=>{dispatched++;throw Object.assign(Error('lost response'),{code:'DELIVERY_UNCERTAIN'})},
   reconcile:async p=>{assert(p.nonce);return {state:'UNKNOWN'}},cancel:async()=>({state:'UNKNOWN',effects:'UNKNOWN'}),verify:async()=>{throw Error('no result')}}
  const control={store,actions,authorize:async r=>({manifest:{incidentId:r.id}}),budget:{ensureIncident:async()=>{},closeIncident:async()=>{}},workerId:'restart-test'}
  await createQualityController(control).tick(otherId);await createQualityController({...control,store:createQualityStore(options)}).tick(otherId)
  assert.equal(dispatched,1)
  // Fixture-only owner simulates a published record to exercise free
  // containment. No application or provider deployment is performed here.
  await owner.query('UPDATE sg2_assistant_quality_control.repository_lock SET incident_id=NULL,lease_token=NULL,lease_until=NULL')
  await owner.query(`UPDATE sg2_assistant_quality_control.incidents SET record=record||$2::jsonb WHERE id=$1`,[otherId,JSON.stringify({status:'RELEASED',pending:null,release:{sourceSha:baseSha},observingUntil:Date.now()+1800000})])
  lease=await store.claim({id:otherId,workerId:'contain',leaseMs:30000})
  const contained=await store.contain({id:otherId,leaseToken:lease.leaseToken,revision:lease.record.revision,reason:'LIMIT_EXCEEDED'})
  assert.equal(contained.status,'OBSERVING');assert.equal(contained.classSuspended,true)
  await store.release({id:otherId,leaseToken:lease.leaseToken})
  const newId=randomUUID();await assert.rejects(store.create({id:newId,repairClass:'C2',causeFingerprint:hash(newId),baseSha}),{code:'CLASS_SUSPENDED'})
 }finally{await fixture.close()}
})
