import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import {createCurrentHumanReadIdentity,createCurrentHumanReadHost,currentHumanReadSourceDigest} from '../src/current-human-read.mjs'
import {OPERATION_CONTRACT,isOperationDenied} from '../src/operation-context.mjs'

const T=2_000_000_000_000,ORIGIN='http://localhost:3400',ISSUER='https://identity.fixture.test',USER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
function fixture(){
 const f={time:T,calls:[],session:{id:'session-fixture',userId:'user_fixture',status:'active',expireAt:T+120000,abandonAt:T+120000,actor:null},
  user:{id:'user_fixture',banned:false,locked:false,deprovisioned:false},
  binding:{environment:'development',issuer:ISSUER,subject:'user_fixture',userId:USER,status:'ACTIVE',version:'1',sourceRef:'SYNTHETIC',expiresAt:new Date(T+120000).toISOString()}}
 f.identity={appId:'srm',environment:'development',issuer:ISSUER,authorizedParties:[ORIGIN]}
 f.auth={isAuthenticated:true,tokenType:'session_token',userId:'user_fixture',sessionId:'session-fixture',sessionClaims:{iss:ISSUER,sub:'user_fixture',sid:'session-fixture',azp:ORIGIN,exp:(T+60000)/1000}}
 f.client={authenticateRequest:async()=>{f.calls.push('sdk');return{status:'signed-in',isAuthenticated:true,toAuth:()=>f.auth}},
  sessions:{getSession:async id=>{f.calls.push('session');assert.equal(id,'session-fixture');return f.session}},
  users:{getUser:async id=>{f.calls.push('account');assert.equal(id,'user_fixture');return f.user}}}
 f.resolveBinding=async()=>{f.calls.push('binding');return f.binding}
 f.make=()=>createCurrentHumanReadIdentity({client:f.client,application:f.identity,resolveBinding:f.resolveBinding,now:()=>f.time})
 f.request=()=>new Request(ORIGIN+'/api/search',{method:'POST',headers:{origin:ORIGIN,authorization:'Bearer fixture_only'}})
 return f
}
test('one SDK verification, two fresh sessions/accounts/bindings, no positive authorization cache',async()=>{
 const f=fixture(),flow=f.make(),request=f.request(),actor=await flow.authenticate(request)
 assert(actor);assert.deepEqual(await flow.revalidate(request,actor),actor)
 assert.deepEqual(f.calls,['sdk','session','account','binding','session','account','binding'])
 assert.equal(await flow.revalidate(request,actor),null)
 flow.close();assert.equal(await flow.authenticate(request),null)
})
for(const[label,change]of[
 ['session revoked',f=>f.session.status='revoked'],['session expired',f=>f.session.expireAt=f.time],
 ['session abandoned',f=>f.session.abandonAt=f.time],['session reassigned',f=>f.session.userId='another-user'],
 ['impersonation introduced',f=>f.session.actor={sub:'operator'}],['account banned',f=>f.user.banned=true],
 ['account locked',f=>f.user.locked=true],['account deprovisioned',f=>f.user.deprovisioned=true],
 ['account reassigned',f=>f.user.id='another-user'],['binding revoked',f=>f.binding.status='REVOKED'],
 ['binding user changed',f=>f.binding.userId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
 ['binding version changed',f=>f.binding.version='2'],['credential expires during operation',f=>f.time=T+60000],
 ])test('current outcome rejects '+label,async()=>{
  const f=fixture(),flow=f.make(),request=f.request(),actor=await flow.authenticate(request);assert(actor)
  change(f);assert.equal(await flow.revalidate(request,actor),null)
  assert.equal(f.calls.filter(x=>x==='sdk').length,1)
 })
test('captured credential facts are immutable while authority observations remain fresh',async()=>{
 const f=fixture(),flow=f.make(),request=f.request(),actor=await flow.authenticate(request)
 f.auth.sessionClaims.exp=(T+3600000)/1000;f.time=T+60000
 assert.equal(await flow.revalidate(request,actor),null,'Mutating the SDK object cannot extend the original verified credential')
})
for(const label of ['another request','cloned actor','changed headers','aborted request','closed execution'])test('identity proof cannot transfer to '+label,async()=>{
 const f=fixture(),flow=f.make(),request=f.request(),actor=await flow.authenticate(request);assert(actor)
 let selected=request,expected=actor
 if(label==='another request')selected=f.request()
 if(label==='cloned actor')expected=structuredClone(actor)
 if(label==='changed headers')request.headers.set('authorization','Bearer replacement')
 if(label==='closed execution')flow.close()
 if(label==='aborted request'){
  const c=new AbortController(),other=f.make(),r=new Request(ORIGIN+'/api/search',{method:'POST',headers:{origin:ORIGIN},signal:c.signal}),a=await other.authenticate(r)
  c.abort();assert.equal(await other.revalidate(r,a),null);return
 }
 assert.equal(await flow.revalidate(selected,expected),null)
 assert.deepEqual(f.calls,['sdk','session','account','binding'])
})
for(const point of ['session','account','binding'])test('outcome '+point+' outage fails closed without credential or ALLOW fallback',async()=>{
 const f=fixture(),flow=f.make(),request=f.request(),actor=await flow.authenticate(request)
 const fail=async()=>{throw Error('upstream fixture failure')}
 if(point==='session')f.client.sessions.getSession=fail
 if(point==='account')f.client.users.getUser=fail
 if(point==='binding')f.binding=null
 if(point==='binding')assert.equal(await flow.revalidate(request,actor),null)
 else await assert.rejects(flow.revalidate(request,actor),e=>e.reasonCode==='POLICY_UNAVAILABLE')
})
test('concurrent identities have independent observations and are not retained across requests',async()=>{
 const f=fixture(),a=f.make(),b=f.make(),ra=f.request(),rb=f.request()
 const[aa,bb]=await Promise.all([a.authenticate(ra),b.authenticate(rb)]);assert(aa);assert(bb)
 assert.equal(await a.revalidate(rb,bb),null)
 assert(await a.revalidate(ra,aa));assert(await b.revalidate(rb,bb))
 assert.equal(f.calls.filter(x=>x==='sdk').length,2);assert.equal(f.calls.filter(x=>x==='session').length,4)
})
test('reverse-proxy normalization retains exact ingress and request-local identity checks',async()=>{
 const f=fixture();f.identity.requestBoundary={publicOrigins:[ORIGIN],internalOrigins:['http://127.0.0.1:9999']}
 const flow=f.make(),request=new Request('http://127.0.0.1:9999/api/search',{method:'POST',headers:{host:'localhost:3400',origin:ORIGIN}})
 const actor=await flow.authenticate(request);assert(actor);assert(await flow.revalidate(request,actor));assert.equal(f.calls.filter(x=>x==='sdk').length,1)
})
test('additive host fingerprint pins all real security dependencies',async()=>{
 assert.match(await currentHumanReadSourceDigest(),/^[a-f0-9]{64}$/)
 for(const application of [{operations:['supplier.private.read']},{operations:['supplier.report.refresh']},{operations:['supplier.report.read','supplier.private.read']}])
  assert.throws(()=>createCurrentHumanReadHost({application}),TypeError)
})

test('current shared read uses real canonical SQL, ordinary roles, RLS, correlated audit and rollback',
 {skip:!process.env.OPERATION_FIXTURE_OWNER_URL},async t=>{
 const rootUrl=new URL(process.env.OPERATION_FIXTURE_OWNER_URL)
 assert(['127.0.0.1','localhost','[::1]'].includes(rootUrl.hostname))
 assert.equal(rootUrl.pathname,'/sg2_operation_test');assert.equal(rootUrl.username,'architecture_test_owner')
 const {Client,Pool}=createRequire(new URL('../../../apps/architecture-lab/package.json',import.meta.url))('pg')
 const DB='current_read_'+randomUUID().replaceAll('-',''),ROLE='current_human_read_fixture',A=randomUUID(),B=randomUUID()
 const root=new Client({connectionString:rootUrl.toString()});await root.connect()
 let owner,pool,audit
 const url=new URL(rootUrl);url.pathname='/'+DB
 const sql=name=>fs.readFileSync(new URL('../migrations/access/'+name,import.meta.url),'utf8')
 const hash=value=>createHash('sha256').update(value).digest('hex'),expiry=()=>new Date(Date.now()+3600000).toISOString()
 try{
  assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[DB])).rowCount,0)
  await root.query(`CREATE DATABASE ${DB}`)
  await root.query('BEGIN;SELECT pg_advisory_xact_lock(170001,20261017)')
  for(const[name,login]of [['profitia_access_owner',false],[ROLE,true]]){
   if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[name])).rowCount)
    await root.query(`CREATE ROLE ${name} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`)
  }
  await root.query('COMMIT')
  owner=new Client({connectionString:url.toString()});await owner.connect()
  await owner.query(`GRANT CREATE ON DATABASE ${DB} TO profitia_access_owner`)
  const controlled=async fn=>{await owner.query('BEGIN;SET LOCAL ROLE profitia_access_owner');try{const v=await fn();await owner.query('COMMIT');return v}catch(e){await owner.query('ROLLBACK');throw e}}
  await controlled(async()=>{
   for(const[file,table]of [['001-internal-access.sql','profitia_access.installation'],['002-module-scope.sql','profitia_modules.installation'],['003-module-audit.sql','profitia_modules.audit_installation']]){
    const source=sql(file);await owner.query(source)
    if(file.startsWith('001'))await owner.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','current-read-fixture','isolated-development',$2)",[hash(source),DB])
    else if(file.startsWith('002'))await owner.query("INSERT INTO profitia_modules.installation(schema_version,schema_digest) VALUES('1.0.0',$1)",[hash(source)])
    else await owner.query(`INSERT INTO ${table} VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')`,[hash(source)])
   }
   await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('srm','ACTIVE')")
   await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,'srm','ACTIVE')",[ROLE])
   await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[USER])
   await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,$2,'user_fixture',$3,'ACTIVE','SYNTHETIC_ONLY',$4)",[randomUUID(),ISSUER,USER,expiry()])
   for(const org of[A,B])await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')",[org])
   await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[A,USER,expiry()])
   await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('srm',$1,'SUPPLIER_INTELLIGENCE',ARRAY['supplier_report'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_ONLY',$2)",[A,expiry()])
   // One module operation permission, deliberately no NIP or indicator grants.
   await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'ALLOW','supplier.report.read','supplier_report')",[randomUUID(),A,USER])
   await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES('srm','supplier_report',$1,'ACTIVE','SYNTHETIC_ONLY',$2)",[randomUUID(),expiry()])
   await owner.query(`CREATE SCHEMA current_read_fixture;CREATE TABLE current_read_fixture.history(organisation_id uuid NOT NULL,user_id uuid NOT NULL,nip text NOT NULL);
    ALTER TABLE current_read_fixture.history ENABLE ROW LEVEL SECURITY;ALTER TABLE current_read_fixture.history FORCE ROW LEVEL SECURITY;
    CREATE POLICY owner_seed ON current_read_fixture.history TO profitia_access_owner USING(true) WITH CHECK(true);
    CREATE POLICY exact_actor ON current_read_fixture.history TO ${ROLE} USING(profitia_access.scope_allows('srm',organisation_id,user_id)) WITH CHECK(profitia_access.scope_allows('srm',organisation_id,user_id));
    GRANT USAGE ON SCHEMA profitia_access,profitia_modules,current_read_fixture TO ${ROLE};
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_access,profitia_modules TO ${ROLE};
    GRANT SELECT,INSERT ON current_read_fixture.history TO ${ROLE}`)
  })
  const runtime=new URL(url);runtime.username=ROLE;runtime.password='isolated_ci_only'
  pool=new Pool({connectionString:runtime.toString(),max:2});audit=new Pool({connectionString:runtime.toString(),max:2})
  const role=(await pool.query('SELECT rolsuper,rolbypassrls,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0]
  assert.deepEqual(role,{rolsuper:false,rolbypassrls:false,rolcreaterole:false})
  const f=fixture();f.auth.sessionClaims.exp=Math.floor(Date.now()/1000)+120;f.session.expireAt=Date.now()+120000;f.session.abandonAt=f.session.expireAt
  let version='1',projections=0
  const host=createCurrentHumanReadHost({clerk:f.client,identity:f.identity,
   application:{appId:'srm',profileId:'SUPPLIER_INTELLIGENCE_STANDALONE',deploymentId:'isolated-current-read',configurationVersion:'1',environment:'development',identityIssuer:ISSUER,organisationId:null,operations:['supplier.report.read'],features:['supplier_report']},
   binding:{applicationId:'srm',environment:'development',projectId:'current-read-fixture',branchId:'isolated-development',databaseName:DB,role:ROLE,schemaDigest:hash(sql('001-internal-access.sql'))},
   module:{id:'supplier_report',schemaDigest:hash(sql('002-module-scope.sql')),auditSchemaDigest:hash(sql('003-module-audit.sql'))},
   independentQuery:audit.query.bind(audit),transact:async fn=>{const c=await pool.connect();try{await c.query('BEGIN');const result=await fn({query:c.query.bind(c),transaction:c});await c.query('COMMIT');return result}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}},
   readResources:async({request})=>({resource:{id:request.resourceId,type:'supplier_report',dataClass:'SHARED_KNOWLEDGE',environment:'development',ownerOrganisationId:null,ownerUserId:null,version,projectionVersion:'current-read-fixture-v1',approvedSharedProjection:true}}),
   projectOutput:value=>{projections++;return value},
  })
  const run=(action=async()=>({status:'READY'}),org=A,nip='9511855233')=>host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'supplier.report.read',organisationId:org,resourceId:'supplier-report:COMPANY:'+nip,payload:{entityType:'COMPANY',nip},request:f.request()},action)
  const count=async()=>Number((await owner.query('SELECT count(*) n FROM current_read_fixture.history')).rows[0].n)
  const write=async(context,c)=>{await c.query('INSERT INTO current_read_fixture.history VALUES($1,$2,$3)',[context.organisationId,context.actorId,'9511855233'])}
  await t.test('one real audited read uses one SDK and two live session/account observations',async()=>{
   f.calls.length=0;const result=await run();assert.equal(result.decision,'ALLOW');assert.equal(result.value.status,'READY')
   assert.deepEqual(f.calls,['sdk','session','account','session','account'])
   const events=(await owner.query("SELECT phase,event->>'decision' AS decision FROM profitia_access.security_events WHERE decision_id=$1 ORDER BY event_id",[result.decisionId])).rows
   assert.equal(events.filter(e=>e.phase==='INTENT'&&e.decision==='ALLOW').length,1)
   assert.equal(events.filter(e=>e.phase==='OUTCOME'&&e.decision==='ALLOW').length,1)
  })
  await t.test('the same module right reads another report without a per-NIP grant',async()=>{assert.equal((await run(undefined,A,'8650004194')).decision,'ALLOW')})
  await t.test('revocation after data work prevents disclosure and rolls back its metadata',async()=>{
   const before=await count();await assert.rejects(run(async(context,c)=>{await write(context,c);f.session.status='revoked';return{status:'READY'}}),isOperationDenied)
   assert.equal(await count(),before);f.session.status='active'
  })
  await t.test('banning the account during execution prevents disclosure',async()=>{
   await assert.rejects(run(async()=>{f.user.banned=true;return{status:'READY'}}),isOperationDenied);f.user.banned=false
  })
  await t.test('a concurrent publication version cannot disclose a mixed report',async()=>{
   await assert.rejects(run(async()=>{version='2';return{status:'READY'}}),e=>e.reasonCode==='RESOURCE_VERSION_CONFLICT')
  })
  await t.test('foreign organization is rejected before business action',async()=>{
   let called=false;await assert.rejects(run(async()=>{called=true},B),isOperationDenied);assert.equal(called,false)
  })
  await t.test('RLS prevents foreign-organization metadata even inside an admitted read',async()=>{
   const before=await count();await assert.rejects(run(async(context,c)=>{await c.query('INSERT INTO current_read_fixture.history VALUES($1,$2,$3)',[B,context.actorId,'9511855233']);return{status:'READY'}}),isOperationDenied);assert.equal(await count(),before)
  })
  await t.test('an explicit resource denial still overrides the module read',async()=>{
   const id=randomUUID();await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature,resource_id) VALUES($1,'srm',$2,$3,'DENY','supplier.report.read','supplier_report','supplier-report:COMPANY:9511855233')",[id,A,USER]))
   await assert.rejects(run(),isOperationDenied);assert.equal((await run(undefined,A,'8650004194')).decision,'ALLOW')
   await controlled(()=>owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[id]))
  })
  assert(projections>0)
 }finally{
  if(pool)await pool.end();if(audit)await audit.end();if(owner)await owner.end()
  await root.query(`DROP DATABASE IF EXISTS ${DB} WITH(FORCE)`);await root.end()
 }
})
