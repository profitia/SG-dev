import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {composeD1Audit,D1_CASE_IDS,createCanonicalD1Audit} from '../src/sg2-d1-pmos-audit-adapter.mjs'
import {createFiveCaseReader} from '../src/sg2-denial-audit-reader.mjs'
import {assertIsolatedTestConnection} from '../../../apps/architecture-lab/src/operation-postgres-fixture.mjs'
const now=()=>Date.now(),host=randomUUID(),hash=v=>createHash('sha256').update(v).digest('hex')
const auth=()=>({schemaVersion:'1.0',status:'APPROVED',authorizationRef:randomUUID(),packetSha256:hash('isolated test packet'),ownerDecisionRef:'TEST-OWNER-DECISION',operationsDecisionRef:'TEST-OPERATIONS-DECISION',producerSourceSha:'64d600192c778b6dc13a3d62b4dd81fd3c008870',consumerSourceSha:'5f745256fecf95ce9043a744333515f0d5ee7be1',pmosSourceSha:'a'.repeat(40),issuedAt:new Date(now()-1000).toISOString(),expiresAt:new Date(now()+60000).toISOString(),operatorAuthority:{private:{identity:'synthetic-private@example.invalid',loginRole:'sg2_d1_private_install_operator',approvalRef:'TEST-PRIVATE-OPERATOR'},source:{identity:'synthetic-source@example.invalid',loginRole:'sg2_d1_source_install_operator',approvalRef:'TEST-SOURCE-OPERATOR'}},nativeLogReadinessRef:'TEST-SYNTHETIC-LOG-ONLY'})
const intention=()=>({contractId:'sg2.dev.five-case-denial-read.v1',executionRef:randomUUID(),environment:'development',caseIds:[...D1_CASE_IDS],maxRows:100})
function fixture(options={}){
 let state={registration:null,flightRecord:null},writes=0
 const port={authorizationSource:'pmos-task-v2:'+'f'.repeat(64),
  async register(v){if(!options.noPersist)state.registration={taskId:v.taskId,conversationId:v.conversationId,project:'SpendGuru 2.0',workspace:'SG-dev',status:'running',promptContent:v.originalTaskRequest};if(options.lostIntentAck)throw Error('SYNTHETIC_UPSTREAM_SECRET')},
  async verifyRegistered(){return !options.blockedPreflight},
  async snapshot(){if(options.readbackDown)throw Error('SYNTHETIC_UPSTREAM_SECRET');return structuredClone(state)},
  async closeout(record){writes++;if(!options.outcomeMissing){state.flightRecord=structuredClone(record);state.registration.status=options.publicationPending?'running':'completed'}if(options.lostOutcomeAck)throw Error('SYNTHETIC_UPSTREAM_SECRET')},
  async nativeEvidence(calls){return options.missingLogs?[]:calls.flatMap(c=>['INTENT','OUTCOME'].map(phase=>({store:c.store,invocationRef:c.invocationRef,phase,projectId:c.store==='private'?'spring-bread-28217539':'autumn-waterfall-65938876',branchId:c.store==='private'?'br-sparkling-term-b99l107x':'br-dry-hall-b294222f',database:c.store==='private'?'platform_private':'neondb',evidenceRef:'SYNTHETIC-NATIVE-'+c.invocationRef+'-'+phase})))}}
 return{port,state:()=>state,writes:()=>writes,audit:composeD1Audit({port,authorization:auth(),now,hostConversationId:host})}
}
const complete=(intent,ack)=>({...intent,authorizationRef:ack.authorizationRef,invocations:D1_CASE_IDS.flatMap(caseId=>['private','source'].map(store=>({caseId,store,invocationRef:randomUUID(),rowCount:0}))),rowCount:0,outputSha256:hash('bounded output'),correlationEvidence:'WINDOW_ONLY'})
test('D1 canonical intent and outcome require matching persisted records, not callback claims',async()=>{const f=fixture(),i=intention(),ack=await f.audit.begin(i);assert(ack.durable);const value=complete(i,ack);assert.deepEqual(await f.audit.complete(value),{durable:true,outputSha256:value.outputSha256});const evidence=JSON.parse(f.state().flightRecord.analysis.reasoningSummary).d1Execution;assert.equal(evidence.nativeLogReferences.length,20);assert.equal(evidence.rowCount,0);assert.equal(f.state().registration.status,'completed')})
test('D1 lost command ACK reconciles actual readback without repeating the operation',async()=>{const f=fixture({lostIntentAck:true,lostOutcomeAck:true}),i=intention(),ack=await f.audit.begin(i);await f.audit.complete(complete(i,ack));assert.equal(f.writes(),1)})
test('D1 fake intent ACK, missing DB, and failed registered governance preflight never authorize a read',async()=>{for(const option of [{noPersist:true},{readbackDown:true},{blockedPreflight:true}]){const f=fixture(option);await assert.rejects(f.audit.begin(intention()),/D1_CANONICAL_AUDIT_UNAVAILABLE/);assert.equal(f.writes(),0)}})
test('D1 incomplete publication or absent outcome withholds completion acknowledgement',async()=>{for(const option of [{outcomeMissing:true},{publicationPending:true}]){const f=fixture(option),i=intention(),ack=await f.audit.begin(i);await assert.rejects(f.audit.complete(complete(i,ack)),/D1_CANONICAL_AUDIT_UNAVAILABLE/);assert.equal(f.writes(),1);await assert.rejects(f.audit.complete(complete(i,ack)));assert.equal(f.writes(),1)}})
test('D1 requires all native INTENT/OUTCOME pairs before success; failure settlement retains no output',async()=>{const f=fixture({missingLogs:true}),i=intention(),ack=await f.audit.begin(i),c=complete(i,ack);await assert.rejects(f.audit.complete(c));await f.audit.failure({...i,authorizationRef:ack.authorizationRef,invocations:[],status:'AUDIT_UNAVAILABLE'});const e=JSON.parse(f.state().flightRecord.analysis.reasoningSummary).d1Execution;assert.equal(e.outputSha256,null);assert.equal(e.executionStatus,'AUDIT_UNAVAILABLE')})
test('D1 rejects unauthorized, expired, oversized, forged or payload-bearing input',async()=>{
 for(const change of [{status:'PROPOSED'},{expiresAt:'invalid'},{expiresAt:new Date(now()-1).toISOString()},{expiresAt:new Date(now()+1800001).toISOString()},{operationsDecisionRef:''},{producerSourceSha:'b'.repeat(40)}])assert.throws(()=>composeD1Audit({port:fixture().port,authorization:{...auth(),...change},now,hostConversationId:host}))
 for(const change of [{caseIds:['H1']},{maxRows:101},{rawPayload:'SYNTHETIC_PRIVATE_DATA'},{environment:'production'}]){const f=fixture();await assert.rejects(f.audit.begin({...intention(),...change}));assert.equal(f.writes(),0)}
 const f=fixture(),i=intention(),ack=await f.audit.begin(i);await assert.rejects(f.audit.complete({...complete(i,ack),rawRows:[]}));assert.equal(f.writes(),0)
})
test('D1 successful prior source cannot be overwritten by failure or a second invocation',async()=>{const f=fixture(),i=intention(),ack=await f.audit.begin(i);await f.audit.complete(complete(i,ack));await assert.rejects(f.audit.failure({...i,authorizationRef:ack.authorizationRef,invocations:[],status:'OVERFLOW'}));await assert.rejects(f.audit.begin(intention()));assert.equal(f.writes(),1)})
test('D1 production factory refuses missing operational approval and native transport before any command',async()=>{await assert.rejects(createCanonicalD1Audit({pmosRoot:'/not-used',authorizationConversationId:'invalid',authorizationPacketSha256:'a'.repeat(64),hostConversationId:host,nativeEvidence:async()=>[]}),/D1_CANONICAL_AUDIT_UNAVAILABLE/)})
test('D1 credential expiry, NOLOGIN, existing session and effective revocation are distinct',{skip:!process.env.OPERATION_FIXTURE_OWNER_URL},async()=>{
 const {Client}=createRequire(new URL('../../../apps/architecture-lab/package.json',import.meta.url))('pg'),url=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner');const admin=new Client({connectionString:url});await admin.connect();const id=randomUUID().replaceAll('-',''),schema='d1_expiry_'+id,role='d1_reader_'+id,credential=randomUUID();let reader;
 try{
  // Synthetic fixture only. This is not any approved D1 SQL artifact or live role.
  await admin.query(`CREATE SCHEMA ${schema};CREATE FUNCTION ${schema}.probe() RETURNS int LANGUAGE sql AS 'SELECT 1';REVOKE ALL ON FUNCTION ${schema}.probe() FROM PUBLIC`)
  const create=(await admin.query("SELECT format('CREATE ROLE %I LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD %L VALID UNTIL %L', $1::text,$2::text,$3::text) AS sql",[role,credential,new Date(Date.now()+60000).toISOString()])).rows[0].sql;await admin.query(create);await admin.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role};GRANT EXECUTE ON FUNCTION ${schema}.probe() TO ${role}`)
  const login=new URL(url);login.username=role;login.password=credential;reader=new Client({connectionString:login.toString()});await reader.connect();assert.equal((await reader.query(`SELECT ${schema}.probe() AS n`)).rows[0].n,1)
  await admin.query(`ALTER ROLE ${role} NOLOGIN`);assert.equal((await reader.query(`SELECT ${schema}.probe() AS n`)).rows[0].n,1,'NOLOGIN does not end or restrict an existing session')
  await admin.query(`REVOKE EXECUTE ON FUNCTION ${schema}.probe() FROM ${role};REVOKE USAGE ON SCHEMA ${schema} FROM ${role}`);await assert.rejects(reader.query(`SELECT ${schema}.probe()`),e=>e.code==='42501')
  await admin.query(`ALTER ROLE ${role} LOGIN VALID UNTIL '2000-01-01T00:00:00Z'`);const expired=new Client({connectionString:login.toString()});try{await assert.rejects(expired.connect(),e=>e.code==='28P01')}finally{await expired.end().catch(()=>{})}
  assert.equal((await reader.query('SELECT 1 AS n')).rows[0].n,1,'Expired password does not terminate an established connection')
  assert.equal((await admin.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS allowed',[role,schema+'.probe()'])).rows[0].allowed,false)
 }finally{if(reader)await reader.end();await admin.query(`DROP FUNCTION ${schema}.probe();DROP SCHEMA ${schema};DROP ROLE IF EXISTS ${role}`);await admin.end()}
})
test('D1 actual isolated PostgreSQL durability, uncertain ACK and five-case reader integration',{skip:!process.env.OPERATION_FIXTURE_OWNER_URL},async()=>{
 const {Client}=createRequire(new URL('../../../apps/architecture-lab/package.json',import.meta.url))('pg'),url=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner');const db=new Client({connectionString:url});await db.connect();const schema='d1_pmos_'+randomUUID().replaceAll('-','');
 try{
  // Isolated copies of the existing PMOS model projections, not a production ledger.
  await db.query(`CREATE SCHEMA ${schema};CREATE TABLE ${schema}.prompt_executions(task_id text PRIMARY KEY,record jsonb NOT NULL);CREATE TABLE ${schema}.conversation_artifacts(task_id text PRIMARY KEY,flight_record_json jsonb NOT NULL)`)
  const f=fixture(),port={...f.port,
   async register(v){await f.port.register(v);await db.query(`INSERT INTO ${schema}.prompt_executions VALUES($1,$2)`,[v.taskId,JSON.stringify(f.state().registration)]);throw Error('lost post-COMMIT ACK')},
   async snapshot(taskId){const r=await db.query(`SELECT record FROM ${schema}.prompt_executions WHERE task_id=$1`,[taskId]),o=await db.query(`SELECT flight_record_json FROM ${schema}.conversation_artifacts WHERE task_id=$1`,[taskId]);return{registration:r.rows[0]?.record||null,flightRecord:o.rows[0]?.flight_record_json||null}},
   async closeout(record){await db.query('BEGIN');await db.query(`INSERT INTO ${schema}.conversation_artifacts VALUES($1,$2)`,[record.metadata.taskId,JSON.stringify(record)]);await db.query(`UPDATE ${schema}.prompt_executions SET record=jsonb_set(record,'{status}','"completed"') WHERE task_id=$1`,[record.metadata.taskId]);await db.query('COMMIT');throw Error('lost durable outcome ACK')},
  };const audit=composeD1Audit({port,authorization:auth(),now,hostConversationId:host})
  const query=store=>async(_q,[caseId])=>({rows:[{result:{caseId,store,rows:[],invocationRef:randomUUID()}}]})
  const reader=createFiveCaseReader({environment:'development',privateQuery:query('private'),sourceQuery:query('source'),audit,now});const result=await reader.read();assert.equal(result.rows.length,0);assert.equal(result.results.length,5)
  const records=await db.query(`SELECT flight_record_json FROM ${schema}.conversation_artifacts`);assert.equal(records.rowCount,1);const e=JSON.parse(records.rows[0].flight_record_json.analysis.reasoningSummary).d1Execution;assert.equal(e.executionStatus,'SUCCESS');assert.equal(e.nativeLogReferences.length,20);assert(!JSON.stringify(e).includes('rawRows'))
 }finally{await db.query(`DROP TABLE IF EXISTS ${schema}.conversation_artifacts;DROP TABLE IF EXISTS ${schema}.prompt_executions;DROP SCHEMA ${schema}`);await db.end()}
})
