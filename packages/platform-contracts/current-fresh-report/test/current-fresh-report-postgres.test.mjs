import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import {assertIsolatedTestConnection} from '../../../../apps/architecture-lab/src/operation-postgres-fixture.mjs'
import {createCurrentFreshReportHost} from '../src/current-fresh-report.mjs'
import {createCurrentHumanReadHost} from '@profitia/platform-contracts/current-human-read'
import {createPrivateOperationHost} from '@profitia/platform-contracts/private-operation-host'
import {createClerkIdentityAuthenticator} from '@profitia/platform-contracts/identity-provider'
import {OPERATION_CONTRACT,operationPayloadDigest} from '@profitia/platform-contracts/operation-context'
import {createPeerOperationSigner,createPeerOperationVerifier} from '@profitia/platform-contracts/peer-operation'
const pg=createRequire(new URL('../../../../apps/architecture-lab/package.json',import.meta.url))('pg')

const U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222'
const ISSUER='https://identity.fixture.test',ORIGIN='https://srm.fixture.test',ROLE='fresh_report_runtime_fixture'
const source=n=>fs.readFileSync(new URL('../../migrations/access/'+n,import.meta.url),'utf8')
const hash=v=>createHash('sha256').update(v).digest('hex')
const future=()=>new Date(Date.now()+3600000).toISOString()
const denied=e=>typeof e?.reasonCode==='string'

test('current FRESH composition: real ordinary-role SQL, rollback, revocation, audit and separate transactions',
 {skip:!process.env.OPERATION_FIXTURE_OWNER_URL},async t=>{
 const rootUrl=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner')
 const root=new pg.Client({connectionString:rootUrl});await root.connect()
 const database='fresh_report_'+randomUUID().replaceAll('-',''),url=new URL(rootUrl);url.pathname='/'+database
 let owner,pool,audit
 try{
  assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rowCount,0)
  await root.query(`CREATE DATABASE ${database}`)
  await root.query('BEGIN;SELECT pg_advisory_xact_lock(170001,20261017)')
  for(const[name,login]of[['profitia_access_owner',false],[ROLE,true]]){
   if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[name])).rowCount)
    await root.query(`CREATE ROLE ${name} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`)
  }
  await root.query('COMMIT')
  owner=new pg.Client({connectionString:url.toString()});await owner.connect()
  await owner.query(`GRANT CREATE ON DATABASE ${database} TO profitia_access_owner`)
  const controlled=async action=>{
   await owner.query('BEGIN;SET LOCAL ROLE profitia_access_owner')
   try{const v=await action();await owner.query('COMMIT');return v}catch(e){await owner.query('ROLLBACK');throw e}
  }
  await controlled(async()=>{
   for(const[file,table]of[
    ['001-internal-access.sql','profitia_access.installation'],['002-module-scope.sql','profitia_modules.installation'],
    ['003-module-audit.sql','profitia_modules.audit_installation'],['006-request-reservation.sql','profitia_requests.installation'],
    ['010-external-request-admission.sql','profitia_requests.external_installation'],
   ]){
    const sql=source(file);await owner.query(sql)
    if(file.startsWith('001'))await owner.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-fresh-report','isolated-development',$2)",[hash(sql),database])
    else if(file.startsWith('002'))await owner.query("INSERT INTO profitia_modules.installation(schema_version,schema_digest) VALUES('1.0.0',$1)",[hash(sql)])
    else await owner.query(`INSERT INTO ${table} VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')`,[hash(sql)])
   }
   await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[U])
   await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE'),($2,'ACTIVE')",[A,B])
   await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('srm','ACTIVE')")
   await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,'srm','ACTIVE')",[ROLE])
   await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,$2,'user_fixture',$3,'ACTIVE','SYNTHETIC_ONLY',$4)",[randomUUID(),ISSUER,U,future()])
   await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[A,U,future()])
   await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('srm',$1,'SUPPLIER_INTELLIGENCE',ARRAY['supplier_report'],'ACTIVE','CONTRACT','SYNTHETIC_ONLY',$2)",[A,future()])
   for(const operation of['supplier.report.read','supplier.report.refresh'])await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'ALLOW',$4,'supplier_report')",[randomUUID(),A,U,operation])
   await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES('srm','supplier_report',$1,'ACTIVE','SYNTHETIC_ONLY',$2)",[randomUUID(),future()])
   await owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity) VALUES($1,'srm',$2,'supplier.report.refresh','ACTIVE','SYNTHETIC_ONLY',now()-interval '1 hour',now()+interval '2 hours',$3,200)",[randomUUID(),A,future()])
   await owner.query(`CREATE SCHEMA fresh_fixture;CREATE TABLE fresh_fixture.metadata(organisation_id uuid NOT NULL,user_id uuid NOT NULL,phase text NOT NULL,request_id uuid);
    ALTER TABLE fresh_fixture.metadata ENABLE ROW LEVEL SECURITY;ALTER TABLE fresh_fixture.metadata FORCE ROW LEVEL SECURITY;
    CREATE POLICY owner_seed ON fresh_fixture.metadata TO profitia_access_owner USING(true) WITH CHECK(true);
    CREATE POLICY exact_actor ON fresh_fixture.metadata TO ${ROLE} USING(profitia_access.scope_allows('srm',organisation_id,user_id)) WITH CHECK(profitia_access.scope_allows('srm',organisation_id,user_id));
    GRANT USAGE ON SCHEMA profitia_access,profitia_modules,profitia_requests,fresh_fixture TO ${ROLE};
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_access,profitia_modules,profitia_requests TO ${ROLE};
    GRANT SELECT,INSERT ON fresh_fixture.metadata TO ${ROLE};
    CREATE FUNCTION fresh_fixture.attempt_write() RETURNS text LANGUAGE plpgsql AS $$ BEGIN INSERT INTO fresh_fixture.metadata VALUES('${A}','${U}','FORGED_PROBE',null); RETURN 'forged'; END $$;
    GRANT EXECUTE ON FUNCTION fresh_fixture.attempt_write() TO ${ROLE};
    CREATE SEQUENCE fresh_fixture.probe_sequence;
    GRANT USAGE ON SEQUENCE fresh_fixture.probe_sequence TO ${ROLE}`)
  })
  const runtime=new URL(url);runtime.username=ROLE;runtime.password='isolated_ci_only'
  pool=new pg.Pool({connectionString:runtime.toString(),max:4});audit=new pg.Pool({connectionString:runtime.toString(),max:2})
  assert.deepEqual((await pool.query('SELECT rolsuper,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=current_user')).rows[0],{rolsuper:false,rolbypassrls:false,rolinherit:false})
  const count=async phase=>Number((await owner.query('SELECT count(*) n FROM fresh_fixture.metadata WHERE phase=$1',[phase])).rows[0].n)
  const intents=async()=>Number((await owner.query('SELECT count(*) n FROM profitia_requests.intents')).rows[0].n)
  function fixture(){
   const f={calls:[],transactions:[],canonicalSql:0,liveTransactions:0,ready:false,version:'1',afterProbe:null,failOutcome:false,offset:0,readCount:0,rootCount:0,workCount:0}
   const now=()=>Date.now()+f.offset
   f.session={id:'session_fixture',userId:'user_fixture',status:'active',actor:null,expireAt:Date.now()+120000,abandonAt:Date.now()+120000}
   f.user={id:'user_fixture',banned:false,locked:false,deprovisioned:false}
   const auth={isAuthenticated:true,tokenType:'session_token',userId:'user_fixture',sessionId:'session_fixture',sessionClaims:{iss:ISSUER,sub:'user_fixture',sid:'session_fixture',azp:ORIGIN,exp:Math.floor(Date.now()/1000)+120}}
   f.auth=auth;f.sdkOrigins=[]
   f.clerk={authenticateRequest:async request=>{f.calls.push('sdk');f.sdkOrigins.push(new URL(request.url).origin);return{status:'signed-in',isAuthenticated:true,toAuth:()=>auth}},
    sessions:{getSession:async()=>{f.calls.push('session');return f.session}},users:{getUser:async()=>{f.calls.push('account');return f.user}}}
   const identity={appId:'srm',environment:'development',issuer:ISSUER,authorizedParties:[ORIGIN]}
   const application={appId:'srm',environment:'development',profileId:'SUPPLIER_INTELLIGENCE_STANDALONE',deploymentId:'synthetic',configurationVersion:'1',identityIssuer:ISSUER,organisationId:null,features:['supplier_report'],operations:['supplier.report.read']}
   const binding={applicationId:'srm',environment:'development',projectId:'isolated-fresh-report',branchId:'isolated-development',databaseName:database,role:ROLE,schemaDigest:hash(source('001-internal-access.sql'))}
   const module={id:'supplier_report',schemaDigest:hash(source('002-module-scope.sql')),auditSchemaDigest:hash(source('003-module-audit.sql'))}
   const driver={independentQuery:(sql,args)=>{f.canonicalSql++;return audit.query(sql,args)},transact:async run=>{
    const c=await pool.connect();let result
    f.liveTransactions++
    try{
     await c.query('BEGIN');f.transactions.push((await c.query('SELECT txid_current()::text n')).rows[0].n)
     const query=async(sql,args)=>{
      f.canonicalSql++
      if(f.failOutcome&&sql.includes('append_audit')&&JSON.parse(args[0]).phase==='OUTCOME')throw Error('SYNTHETIC_AUDIT_OUTAGE')
      return c.query(sql,args)
     }
     result=await run({query,transaction:c});await c.query('COMMIT')
    }catch(e){await c.query('ROLLBACK');throw e}finally{f.liveTransactions--;c.release()}
    if(result?.value?.status==='MISS'&&f.afterProbe)await f.afterProbe()
    return result
   }}
   const read={application,binding,module,...driver,readResources:async({request})=>({resource:{id:request.resourceId,type:'supplier_report',dataClass:'SHARED_KNOWLEDGE',environment:'development',ownerOrganisationId:null,ownerUserId:null,version:f.version,projectionVersion:'synthetic-ready-v1',approvedSharedProjection:true}}),projectOutput:v=>v}
   f.options={clerk:f.clerk,identity,receiverBoundary:{publicOrigins:[ORIGIN],internalOrigins:['http://127.0.0.1:9999']},probe:{...read},read:{...read},now,
    refresh:{...read,application:{...application,operations:['supplier.report.refresh']},requestLedger:{schemaDigest:hash(source('006-request-reservation.sql')),externalSchemaDigest:hash(source('010-external-request-admission.sql'))},
     readResources:async({request,scope})=>({resource:{id:request.resourceId,type:'supplier_report_request',dataClass:'OPERATION_AUDIT',environment:'development',ownerOrganisationId:scope.organisationId,ownerUserId:scope.userId,version:'1',projectionVersion:'synthetic-intent-v1'}})}}
   const controller=new AbortController()
   f.controller=controller
   f.input={request:new Request(ORIGIN+'/api/search',{method:'POST',headers:{origin:ORIGIN},signal:controller.signal}),organisationId:A,nip:'5272443955',idempotencyKey:randomUUID().replaceAll('-','')}
   const write=(phase,context,c,org=context.organisationId)=>c.query('INSERT INTO fresh_fixture.metadata VALUES($1,$2,$3,$4)',[org,context.actorId,phase,context.requestReservation?.requestId??null])
   f.actions={probe:async()=>f.ready?{status:'READY',value:{report:'cached'}}:{status:'MISS'},
    refresh:async(context,c)=>{f.rootCount++;await write('ADMISSION',context,c);return{requestId:context.requestReservation.requestId,status:'ACCEPTED'}},
    work:async selection=>{
     f.workCount++;assert.equal(f.liveTransactions,0,'No probe/admission transaction spans acquisition or native work')
     assert.equal(selection.organisationId,A);assert.deepEqual(selection.command,{kind:'SUPPLIER_REPORT',nip:'5272443955'})
     assert.equal((await owner.query("SELECT status FROM profitia_requests.intents WHERE request_id=$1",[selection.requestId])).rows[0]?.status,'ACCEPTED','Admission really committed before work')
    },
    read:async(context,c)=>{f.readCount++;await write('DISCLOSURE',context,c);return{status:'READY',value:{report:'fresh'}}}}
   f.write=write;f.run=()=>createCurrentFreshReportHost(f.options).execute(f.input,f.actions)
   f.legacy=async()=>{
    const {request,organisationId,nip,idempotencyKey}=f.input,payload={entityType:'COMPANY',nip},command={kind:'SUPPLIER_REPORT',nip}
    const input={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'supplier.report.read',organisationId,resourceId:'supplier-report:COMPANY:'+nip,payload,request}
    const reader=base=>createCurrentHumanReadHost({...base,clerk:f.clerk,identity,now})
    const probe=(await reader(f.options.probe).execute(input,f.actions.probe)).value
    if(probe.status==='READY')return probe.value
    const root=createPrivateOperationHost({...f.options.refresh,now,createAuthenticator:({resolveBinding})=>createClerkIdentityAuthenticator({client:f.clerk,application:identity,resolveBinding,now})})
    const admission=await root.execute({...input,operation:'supplier.report.refresh',resourceId:'supplier-request:'+operationPayloadDigest(command),payload:command,idempotencyKey},f.actions.refresh)
    await f.actions.work({requestId:admission.value.requestId,organisationId,command},request.signal)
    return (await reader(f.options.read).execute(input,f.actions.read)).value.value
   }
   return f
  }
  const proofSql="SELECT current_setting('transaction_read_only') AS read_only"
  function readOnlyFixture(){
   const f=fixture(),read=f.options.probe.readResources,probe=f.actions.probe
   f.options.probeReadOnly={statements:[proofSql,'SELECT fresh_fixture.attempt_write()',"SELECT nextval('fresh_fixture.probe_sequence')","SELECT set_config('transaction_read_only','off',true)"]}
   f.options.probe.readResources=async state=>{
    assert.deepEqual(Object.keys(state.transaction),['query']);assert.equal(state.query,state.transaction.query)
    assert.equal((await state.query(proofSql,[])).rows[0].read_only,'on')
    return read(state)
   }
   f.actions.probe=async(context,port)=>{
    assert(Object.isFrozen(port));assert.deepEqual(Object.keys(port),['query'])
    assert.equal((await port.query(proofSql,[])).rows[0].read_only,'on')
    f.port=port;return probe(context,port)
   }
   f.readyCount=0
   f.actions.ready=async(value,context,transaction)=>{f.readyCount++;await f.write('READY',context,transaction);return value}
   return f
  }
  await t.test('opt-in MISS is PostgreSQL read-only, commits only canonical audit, and defers one HUMAN pair',async()=>{
   const f=readOnlyFixture(),before=await count('READY'),rowsBefore=await owner.query('SELECT count(*) n FROM fresh_fixture.metadata')
   assert.deepEqual(await f.run(),{report:'fresh'})
   assert.equal(f.calls.filter(x=>x==='session').length,3);assert.equal(f.calls.filter(x=>x==='account').length,3)
   assert.equal(f.readyCount,0);assert.equal(await count('READY'),before);assert.equal(f.workCount,1)
   assert.equal(Number((await owner.query('SELECT count(*) n FROM fresh_fixture.metadata')).rows[0].n),Number(rowsBefore.rows[0].n)+2)
   const rows=(await owner.query('SELECT phase,decision_id FROM profitia_access.security_events ORDER BY event_id DESC LIMIT 6')).rows
   assert.equal(new Set(rows.map(r=>r.decision_id)).size,3)
   for(const id of new Set(rows.map(r=>r.decision_id)))assert.deepEqual(rows.filter(r=>r.decision_id===id).map(r=>r.phase).sort(),['INTENT','OUTCOME'])
   assert.equal(new Set(f.transactions).size,3)
  })
  await t.test('opt-in READY writes metadata before fresh H2, never opens Root/Work, and preserves the result',async()=>{
   const f=readOnlyFixture(),before=await count('READY');f.ready=true
   assert.deepEqual(await f.run(),{report:'cached'});assert.equal(await count('READY'),before+1)
   assert.equal(f.calls.filter(x=>x==='session').length,2);assert.equal(f.calls.filter(x=>x==='account').length,2)
   assert.equal(f.readyCount,1);assert.equal(f.workCount,0);assert.equal(f.rootCount,0)
  })
  await t.test('controlled equivalent callbacks report the added SQL cost separately from removed HUMAN calls',async t=>{
   for(const ready of [false,true]){
    const baseline=fixture(),candidate=fixture();baseline.ready=ready;candidate.ready=ready
    candidate.options.probeReadOnly={statements:['SELECT 1']};candidate.actions.ready=async value=>value
    assert.deepEqual(await baseline.run(),await candidate.run())
    const accounts=f=>f.calls.filter(x=>x==='account').length
    assert.equal(accounts(candidate),ready?2:3);assert.equal(accounts(baseline),ready?2:4)
    assert.equal(candidate.transactions.length,baseline.transactions.length)
    assert(candidate.canonicalSql>baseline.canonicalSql,'Read-only rollback protection adds SQL; do not claim SQL savings')
    t.diagnostic(JSON.stringify({mode:ready?'READY':'MISS_FRESH',baselineAccounts:accounts(baseline),candidateAccounts:accounts(candidate),baselineInstrumentedSql:baseline.canonicalSql,candidateInstrumentedSql:candidate.canonicalSql,livePerformanceMeasured:false}))
   }
  })
  for(const field of ['session','account'])await t.test('opt-in READY revocation during its writer rolls back metadata at H2: '+field,async()=>{
   const f=readOnlyFixture(),before=await count('READY'),ready=f.actions.ready;f.ready=true
   f.actions.ready=async(...args)=>{const v=await ready(...args);if(field==='session')f.session.status='revoked';else f.user.banned=true;return v}
   await assert.rejects(f.run(),denied);assert.equal(await count('READY'),before);assert.equal(f.workCount,0)
  })
  for(const field of ['session','account'])for(const stage of ['PROBE','ROOT','FINAL'])await t.test('opt-in '+field+' revoked during '+stage+' cannot commit Root or disclose',async()=>{
   const f=readOnlyFixture(),beforeRoot=await count('ADMISSION'),beforeRead=await count('DISCLOSURE'),beforeIntents=await intents()
   const name=stage==='PROBE'?'probe':stage==='ROOT'?'refresh':'read',original=f.actions[name]
   f.actions[name]=async(...args)=>{const v=await original(...args);if(field==='session')f.session.status='revoked';else f.user.banned=true;return v}
   await assert.rejects(f.run(),denied)
   assert.equal(await count('ADMISSION'),beforeRoot+(stage==='FINAL'?1:0));assert.equal(await count('DISCLOSURE'),beforeRead)
   assert.equal(await intents(),beforeIntents+(stage==='FINAL'?1:0));assert.equal(f.workCount,stage==='FINAL'?1:0)
  })
  for(const sql of ['SELECT fresh_fixture.attempt_write()',"SELECT nextval('fresh_fixture.probe_sequence')","SELECT set_config('transaction_read_only','off',true)"])
   await t.test('PostgreSQL blocks a SELECT effect even when the probe swallows its error: '+sql,async()=>{
    const f=readOnlyFixture(),before=await count('FORGED_PROBE'),beforeIntents=await intents();let code
    f.actions.probe=async(_context,port)=>{try{await port.query(sql,[])}catch(e){code=e.code}return{status:'MISS'}}
    await assert.rejects(f.run(),denied);assert.equal(code,sql.includes('set_config')?'25001':'25006')
    assert.equal(await count('FORGED_PROBE'),before);assert.equal(await intents(),beforeIntents);assert.equal(f.workCount,0)
   })
  for(const sql of ['COMMIT','ROLLBACK','SET LOCAL transaction_read_only = off','SELECT 1; COMMIT',"INSERT INTO fresh_fixture.metadata VALUES(null,null,'FORGED_PROBE',null)"])
   await t.test('closed query port refuses raw control/write SQL even when caught: '+sql,async()=>{
    const f=readOnlyFixture();f.actions.probe=async(_context,port)=>{await assert.rejects(port.query(sql,[]),denied);return{status:'MISS'}}
    await assert.rejects(f.run(),denied);assert.equal(f.workCount,0)
   })
  await t.test('MISS with an undisclosed value is not a genuine MISS',async()=>{
   const f=readOnlyFixture();f.actions.probe=async()=>({status:'MISS',value:{report:'forged'}})
   await assert.rejects(f.run(),denied);assert.equal(f.workCount,0)
  })
  for(const stage of ['resource','projection'])await t.test('read-only enforcement also covers the '+stage+' adapter',async()=>{
   const f=readOnlyFixture(),before=await count('FORGED_PROBE');let code
   const attempt=async port=>{try{await port.query('SELECT fresh_fixture.attempt_write()',[])}catch(e){code=e.code}}
   if(stage==='resource'){
    const read=f.options.probe.readResources
    f.options.probe.readResources=async state=>{await attempt(state.transaction);return read(state)}
   }else f.options.probe.projectOutput=async(value,_context,port)=>{await attempt(port);return value}
   await assert.rejects(f.run(),denied);assert.equal(code,'25006');assert.equal(await count('FORGED_PROBE'),before);assert.equal(f.workCount,0)
  })
  await t.test('concurrent probe queries and a caught port error cannot produce a successful MISS',async()=>{
   const f=readOnlyFixture(),sql='SELECT pg_sleep(0.02)';f.options.probeReadOnly.statements.push(sql)
   f.actions.probe=async(_context,port)=>{await Promise.allSettled([port.query(sql,[]),port.query(proofSql,[])]);return{status:'MISS'}}
   await assert.rejects(f.run(),denied);assert.equal(f.workCount,0)
  })
  await t.test('opt-in factory cannot be replayed for another request',async()=>{
   const f=readOnlyFixture();f.ready=true;const host=createCurrentFreshReportHost(f.options)
   assert.deepEqual(await host.execute(f.input,f.actions),{report:'cached'});const calls=f.calls.length
   await assert.rejects(host.execute({...f.input,request:new Request(ORIGIN+'/other')},f.actions),e=>e.reasonCode==='ACCESS_BASIS_INVALID')
   assert.equal(f.calls.length,calls)
  })
  await t.test('a leaked probe port cannot execute in Work or another opening',async()=>{
   const f=readOnlyFixture(),work=f.actions.work
   f.actions.work=async(...args)=>{await assert.rejects(f.port.query(proofSql,[]),denied);await work(...args)}
   assert.deepEqual(await f.run(),{report:'fresh'});await assert.rejects(f.port.query(proofSql,[]),denied)
   const other=readOnlyFixture();other.ready=true;assert.deepEqual(await other.run(),{report:'cached'})
  })
  await t.test('opt-in foreign organisation cannot enter the effect-free probe',async()=>{
   const f=readOnlyFixture();f.input.organisationId=B;let called=false;f.actions.probe=async()=>{called=true;return{status:'MISS'}}
   await assert.rejects(f.run(),denied);assert.equal(called,false);assert.equal(f.workCount,0)
  })
  await t.test('opt-in resource drift on MISS blocks transition before Root',async()=>{
   const f=readOnlyFixture();f.actions.probe=async()=>{f.version='2';return{status:'MISS'}}
   await assert.rejects(f.run(),e=>e.reasonCode==='RESOURCE_VERSION_CONFLICT');assert.equal(f.rootCount,0)
  })
  for(const mutation of ['abort','expiry'])await t.test('opt-in '+mutation+' cannot promote MISS to Work',async()=>{
   const f=readOnlyFixture();f.afterProbe=()=>{if(mutation==='abort')f.controller.abort();else f.offset=180000}
   await assert.rejects(f.run());assert.equal(f.workCount,0)
  })
  await t.test('opt-in current product revocation after MISS blocks Root and provider/Work',async()=>{
   const f=readOnlyFixture(),before=await intents();f.afterProbe=()=>controlled(()=>owner.query("UPDATE profitia_access.product_grants SET status='REVOKED' WHERE application_id='srm'"))
   try{await assert.rejects(f.run(),denied);assert.equal(await intents(),before);assert.equal(f.workCount,0)}
   finally{await controlled(()=>owner.query("UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE application_id='srm'"))}
  })
  await t.test('READY remains two fresh session/account observations and never enters refresh or Work',async()=>{
   const f=fixture();f.ready=true
   assert.deepEqual(await f.run(),{report:'cached'})
   assert.deepEqual(f.calls,['sdk','session','account','session','account'])
   assert.equal(f.rootCount,0);assert.equal(f.workCount,0);assert.equal(f.readCount,0);assert.equal(f.transactions.length,1)
  })
  await t.test('MISS keeps H2; FRESH has four current HUMAN observations and three actual transactions',async()=>{
   const f=fixture(),before=await count('DISCLOSURE')
   assert.deepEqual(await f.run(),{report:'fresh'})
   assert.equal(f.calls.filter(x=>x==='session').length,4);assert.equal(f.calls.filter(x=>x==='account').length,4)
   assert.equal(f.calls.filter(x=>x==='sdk').length,3);assert.equal(new Set(f.transactions).size,3)
   assert.equal(await count('DISCLOSURE'),before+1);assert.equal(f.workCount,1)
   const rows=(await owner.query('SELECT phase,decision_id FROM profitia_access.security_events ORDER BY event_id DESC LIMIT 6')).rows
   assert.equal(new Set(rows.map(r=>r.decision_id)).size,3)
   for(const id of new Set(rows.map(r=>r.decision_id)))assert.deepEqual(rows.filter(r=>r.decision_id===id).map(r=>r.phase).sort(),['INTENT','OUTCOME'])
  })
  await t.test('controlled baseline comparison removes one HUMAN pair without adding canonical SQL calls',async()=>{
   const prior=fixture(),candidate=fixture()
   assert.deepEqual(await prior.legacy(),{report:'fresh'});assert.deepEqual(await candidate.run(),{report:'fresh'})
   assert.equal(prior.calls.filter(x=>x==='account').length,5);assert.equal(prior.calls.filter(x=>x==='session').length,5)
   assert.equal(candidate.calls.filter(x=>x==='account').length,4);assert.equal(candidate.calls.filter(x=>x==='session').length,4)
   assert.equal(candidate.canonicalSql,prior.canonicalSql)
  })
  for(const stage of ['PROBE','ROOT','FINAL'])for(const field of ['session','account'])await t.test(field+' revoked at '+stage+' cannot cross its boundary',async()=>{
   const f=fixture(),beforeRead=await count('DISCLOSURE'),beforeRoot=await count('ADMISSION'),beforeIntents=await intents()
   const revoke=()=>{if(field==='session')f.session.status='revoked';else f.user.banned=true}
   const name=stage==='PROBE'?'probe':stage==='ROOT'?'refresh':'read',previous=f.actions[name]
   f.actions[name]=async(...args)=>{const v=await previous(...args);revoke();return v}
   await assert.rejects(f.run(),denied)
   assert.equal(await count('DISCLOSURE'),beforeRead)
   assert.equal(await count('ADMISSION'),beforeRoot+(stage==='FINAL'?1:0))
   assert.equal(await intents(),beforeIntents+(stage==='FINAL'?1:0))
   if(stage!=='FINAL')assert.equal(f.workCount,0)
  })
  await t.test('revocation after a committed MISS is rechecked before root COMMIT',async()=>{
   const f=fixture(),before=await count('ADMISSION');f.afterProbe=()=>{f.user.banned=true}
   await assert.rejects(f.run(),denied);assert.equal(await count('ADMISSION'),before);assert.equal(f.workCount,0)
  })
  await t.test('last asynchronous root outcome adapter cannot hide an account revocation',async()=>{
   const f=fixture(),before=await intents();f.options.refresh.describeOutcome=async()=>{f.user.banned=true;return'SUCCEEDED'}
   await assert.rejects(f.run(),denied);assert.equal(await intents(),before);assert.equal(f.workCount,0)
  })
  await t.test('foreign organisation is denied before the first business callback',async()=>{
   const f=fixture();f.input.organisationId=B;let called=false;f.actions.probe=async()=>{called=true;return{status:'MISS'}}
   await assert.rejects(f.run(),denied);assert.equal(called,false);assert.equal(f.workCount,0)
  })
  await t.test('RLS rejects a foreign organisation insert inside final read',async()=>{
   const f=fixture(),before=await count('DISCLOSURE');f.actions.read=async(context,c)=>{await f.write('DISCLOSURE',context,c,B);return{status:'READY',value:'forged'}}
   await assert.rejects(f.run(),denied);assert.equal(await count('DISCLOSURE'),before)
  })
  await t.test('private projections cannot be admitted as the shared report',async()=>{
   const f=fixture(),read=f.options.probe.readResources;f.options.probe.readResources=async state=>{const r=await read(state);r.resource.dataClass='ORGANISATION_PRIVATE';r.resource.ownerOrganisationId=A;return r}
   await assert.rejects(f.run(),denied);assert.equal(f.rootCount,0);assert.equal(f.workCount,0)
  })
  await t.test('resource version drift during final read withholds output and rolls back metadata',async()=>{
   const f=fixture(),before=await count('DISCLOSURE'),read=f.actions.read
   f.actions.read=async(...args)=>{const v=await read(...args);f.version='2';return v}
   await assert.rejects(f.run(),e=>e.reasonCode==='RESOURCE_VERSION_CONFLICT');assert.equal(await count('DISCLOSURE'),before)
  })
  await t.test('grant revoked after Work prevents final disclosure, preserving the committed root receipt',async()=>{
   const f=fixture(),beforeRead=await count('DISCLOSURE'),beforeIntents=await intents(),work=f.actions.work
   f.actions.work=async(...args)=>{await work(...args);await controlled(()=>owner.query("UPDATE profitia_access.product_grants SET status='REVOKED' WHERE application_id='srm'"))}
   try{await assert.rejects(f.run(),denied);assert.equal(await count('DISCLOSURE'),beforeRead);assert.equal(await intents(),beforeIntents+1)}
   finally{await controlled(()=>owner.query("UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE application_id='srm'"))}
  })
  await t.test('internal binding changed after MISS cannot reuse the actor',async()=>{
   const f=fixture(),before=await intents();f.afterProbe=()=>controlled(()=>owner.query("UPDATE profitia_access.external_identities SET status='REVOKED' WHERE subject='user_fixture'"))
   try{await assert.rejects(f.run(),denied);assert.equal(await intents(),before);assert.equal(f.workCount,0)}
   finally{await controlled(()=>owner.query("UPDATE profitia_access.external_identities SET status='ACTIVE' WHERE subject='user_fixture'"))}
  })
  await t.test('changed request headers after Work cannot select another credential',async()=>{
   const f=fixture(),before=await count('DISCLOSURE'),work=f.actions.work
   f.actions.work=async(...args)=>{await work(...args);f.input.request.headers.set('authorization','Bearer synthetic_replacement')}
   await assert.rejects(f.run(),denied);assert.equal(await count('DISCLOSURE'),before)
  })
  await t.test('abort after Work cannot disclose a prepared report',async()=>{
   const f=fixture(),before=await count('DISCLOSURE'),work=f.actions.work;f.actions.work=async(...args)=>{await work(...args);f.controller.abort()}
   await assert.rejects(f.run(),e=>e.name==='AbortError');assert.equal(await count('DISCLOSURE'),before)
  })
  await t.test('Work cannot substitute its own response for final read',async()=>{
   const f=fixture();f.actions.work=async()=>({report:'bypass'})
   await assert.rejects(f.run(),denied);assert.equal(f.readCount,0)
  })
  await t.test('outage at the final identity boundary fails closed',async()=>{
   const f=fixture(),before=await count('DISCLOSURE'),work=f.actions.work;f.actions.work=async(...args)=>{await work(...args);f.clerk.sessions.getSession=async()=>{throw Error('SYNTHETIC_OUTAGE')}}
   await assert.rejects(f.run(),e=>e.reasonCode==='POLICY_UNAVAILABLE');assert.equal(await count('DISCLOSURE'),before)
  })
  await t.test('canonical OUTCOME outage rolls back final metadata and withholds output',async()=>{
   const f=fixture(),before=await count('DISCLOSURE'),read=f.actions.read
   f.actions.read=async(...args)=>{const v=await read(...args);f.failOutcome=true;return v}
   await assert.rejects(f.run(),e=>e.reasonCode==='AUDIT_UNAVAILABLE');assert.equal(await count('DISCLOSURE'),before)
  })
  await t.test('original credential expiry during work is not extended by another official observation',async()=>{
   const f=fixture(),before=await count('DISCLOSURE'),work=f.actions.work;f.actions.work=async(...args)=>{await work(...args);f.offset=180000}
   await assert.rejects(f.run(),denied);assert.equal(await count('DISCLOSURE'),before)
  })
  await t.test('independent concurrent openings do not share identity, transactions or report state',async()=>{
   const a=fixture(),b=fixture();a.ready=true;b.ready=true
   assert.deepEqual(await Promise.all([a.run(),b.run()]),[{report:'cached'},{report:'cached'}])
   assert.equal(a.calls.filter(x=>x==='account').length,2);assert.equal(b.calls.filter(x=>x==='account').length,2)
   assert.notEqual(a.transactions[0],b.transactions[0])
  })
  async function peerFixture(){
   const f=fixture(),caller='https://sg2.fixture.test'
   const configuration={environment:'development',callerApplicationId:'spendguru',receiverApplicationId:'srm',sourceOrigin:caller,targetOrigin:ORIGIN,
    keyId:'isolated-fresh-report',key:new Uint8Array(32).fill(7),internalOrigins:[],routes:[{method:'POST',path:'/api/search',maximumRequestBytes:2048,requireIdempotencyKey:true}]}
   f.options.identity.authorizedParties=[caller,ORIGIN];f.auth.sessionClaims.azp=caller
   f.options.identity.requestBoundary={publicOrigins:[caller,ORIGIN],internalOrigins:['http://127.0.0.1:9999']}
   const now=()=>Date.now()+f.offset
   f.input.request=await createPeerOperationSigner(configuration,{now})(new Request(ORIGIN+'/api/search',{method:'POST',signal:f.controller.signal,
    headers:{authorization:'Bearer fixture_only','content-type':'application/json','idempotency-key':f.input.idempotencyKey},body:JSON.stringify({identifier:f.input.nip})}))
   assert(await createPeerOperationVerifier(configuration,{now})(f.input.request))
   return f
  }
  await t.test('verified SG2 peer retains current observations on the original SRM receiver request',async()=>{
   const f=await peerFixture();assert.deepEqual(await f.run(),{report:'fresh'})
   assert.deepEqual(f.sdkOrigins,['https://sg2.fixture.test','https://sg2.fixture.test','https://sg2.fixture.test'])
   assert.equal(f.calls.filter(x=>x==='session').length,4)
  })
  await t.test('signed headers copied without the verifier capability cannot open the report',async()=>{
   const f=await peerFixture();f.input.request=f.input.request.clone()
   await assert.rejects(f.run(),denied);assert.equal(f.workCount,0)
  })
  await t.test('an authorized caller origin is not an alternate SRM HTTP ingress',async()=>{
   const f=await peerFixture()
   f.input.request=new Request('https://sg2.fixture.test/api/search',{method:'POST',headers:{authorization:'Bearer fixture_only'}})
   await assert.rejects(f.run(),denied);assert.deepEqual(f.calls,[]);assert.equal(f.workCount,0)
  })
  await t.test('caller-selected Host cannot change the canonical receiver',async()=>{
   const f=fixture();f.input.request.headers.set('host','sg2.fixture.test')
   await assert.rejects(f.run(),denied);assert.deepEqual(f.calls,[])
  })
  await t.test('explicit reverse proxy ingress keeps the original request but ignores untrusted forwarding authority',async()=>{
   const f=fixture();f.ready=true;f.options.identity.requestBoundary=f.options.receiverBoundary
   f.input.request=new Request('http://127.0.0.1:9999/api/search',{method:'POST',headers:{host:'srm.fixture.test',origin:ORIGIN,'x-forwarded-host':'foreign.invalid','x-forwarded-proto':'https'}})
   assert.deepEqual(await f.run(),{report:'cached'});assert.deepEqual(f.sdkOrigins,[ORIGIN])
  })
  await t.test('peer expiry during Work cannot be extended by the FRESH composition',async()=>{
   const f=await peerFixture(),before=await count('DISCLOSURE'),work=f.actions.work
   f.actions.work=async(...args)=>{await work(...args);f.offset=61000}
   await assert.rejects(f.run(),denied);assert.equal(await count('DISCLOSURE'),before)
  })
 }finally{
  if(pool)await pool.end();if(audit)await audit.end();if(owner)await owner.end()
  await root.query(`DROP DATABASE IF EXISTS ${database} WITH(FORCE)`);await root.end()
 }
})
