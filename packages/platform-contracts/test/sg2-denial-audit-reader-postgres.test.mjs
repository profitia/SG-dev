import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomUUID,createHash} from 'node:crypto'
import {createRequire} from 'node:module'
const {Client}=createRequire(new URL('../../../apps/architecture-lab/package.json',import.meta.url))('pg')
import {assertIsolatedTestConnection} from '../../../apps/architecture-lab/src/operation-postgres-fixture.mjs'
import {CASES,createFiveCaseReader} from '../src/sg2-denial-audit-reader.mjs'

const root=new URL('../../../',import.meta.url)
const load=path=>fs.readFileSync(new URL(path,root),'utf8')
const prefix='packages/platform-contracts/migrations/denial-audit/'
const digest=v=>createHash('sha256').update(v).digest('hex')
test('D1 actual independent PostgreSQL stores, ordinary roles, fixed SQL projection and rollback-independent audit', {skip:!process.env.OPERATION_FIXTURE_OWNER_URL},async t=>{
 const rootUrl=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner')
 const admin=new Client({connectionString:rootUrl});await admin.connect()
 const stores=[],created=[]
 try{
  await admin.query('SELECT pg_advisory_lock(20261103,4101)')
  for(const role of ['profitia_access_owner','profitia_ingestion_owner']){
   await admin.query('BEGIN; SELECT pg_advisory_xact_lock(170001,20261017)')
   if(!(await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await admin.query(`CREATE ROLE ${role} NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION`)
   await admin.query('COMMIT')
  }
  for(const store of ['private','source']){
   const priv=store==='private',database=priv?'platform_private':'neondb',ownerRole=priv?'profitia_access_owner':'profitia_ingestion_owner',base=priv?'profitia_access':'profitia_ingestion',readerRole=`sg2_d1_${store}_denial_reader`
   assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rowCount,0,'Never overwrite an existing database')
   assert.equal((await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[readerRole])).rowCount,0,'Never reuse an existing reader')
   await admin.query(`CREATE DATABASE ${database}`);created.push(database)
   const url=new URL(rootUrl);url.pathname='/'+database
   const owner=new Client({connectionString:url.toString()});await owner.connect()
   await owner.query(`GRANT CREATE ON DATABASE ${database} TO ${ownerRole};SET ROLE ${ownerRole}`)
   await owner.query(load(`packages/platform-contracts/migrations/access/${priv?'001-internal-access':'008-platform-ingestion'}.sql`))
   await owner.query(`INSERT INTO ${base}.installation VALUES(true,'1.0.0',$1,'development',$2,$3,$4,$5)`,['a'.repeat(64),priv?'spring-bread-28217539':'autumn-waterfall-65938876',priv?'br-sparkling-term-b99l107x':'br-dry-hall-b294222f',database,priv?339:70])
   const before=(await owner.query(`SELECT * FROM ${base}.installation`)).rows
   // Entirely synthetic payload deliberately contains excluded fields.
   const insert=async(c,{recorded=c.start,env='development',deployment=c.deploymentId,reason='POLICY_UNAVAILABLE',operation=priv?'benchmark.discovery.request':'knowledge.ingest'}={})=>{
    await owner.query(`INSERT INTO ${base}.security_events(recorded_at,application_id,environment,decision_id,phase,event) VALUES($1,$2,$3,$4,'DECISION',$5::jsonb)`,[recorded,priv?'spendguru':'spendguru-benchmark-source',env,randomUUID(),JSON.stringify({applicationId:priv?'spendguru':'spendguru-benchmark-source',environment:env,deploymentId:deployment,operation,decision:'DENY',reasonCode:reason,actorId:'SYNTHETIC_PERSON',organisationId:'SYNTHETIC_ORG',correlationId:randomUUID(),rawPayload:'SYNTHETIC_PRIVATE_PAYLOAD'})])
   }
   for(const c of CASES){await insert(c);await insert(c,{recorded:c.end});await insert(c,{env:'staging'});await insert(c,{deployment:'wrong-deploy'});await insert(c,{operation:'unapproved.operation'})}
   await owner.query('RESET ROLE');await owner.query(load(prefix+'roles.sql'))
   // Test-only local password. No product/Neon credentials are used.
   await owner.query(`ALTER ROLE ${readerRole} PASSWORD 'isolated_ci_only'`)
   await owner.query(`SET ROLE ${ownerRole}`)
   await t.test(`${store}: partial installation failure leaves no schema or EXECUTE grant`,async()=>{
    await assert.rejects(owner.query(load(prefix+`${store}.sql`).replace('COMMIT;','SELECT 1/0; COMMIT;')))
    await owner.query('ROLLBACK')
    assert.equal((await owner.query('SELECT to_regnamespace($1) AS schema',[`profitia_sg2_d1_${store}`])).rows[0].schema,null)
    assert.deepEqual((await owner.query(`SELECT * FROM ${base}.installation`)).rows,before)
   })
   await owner.query(load(prefix+`${store}.sql`))
   assert.deepEqual((await owner.query(`SELECT * FROM ${base}.installation`)).rows,before,'Installing D1 must not alter shared authority revision')
   const readerUrl=new URL(url);readerUrl.username=readerRole;readerUrl.password='isolated_ci_only'
   const reader=new Client({connectionString:readerUrl.toString()});await reader.connect()
   const notices=[];reader.on('notice',n=>{if(n.message.startsWith('SG2_D1_READ '))notices.push(n.message)})
   await reader.query('SET client_min_messages=log')
   stores.push({store,base,database,owner,reader,ownerRole,readerRole,insert,notices,before})
  }
  await t.test('all5cases across2actualstores expose only fixed technical fields; exact boundaries excluded',async()=>{
   let complete
   const read=createFiveCaseReader({environment:'development',privateQuery:(q,v)=>stores[0].reader.query(q,v),sourceQuery:(q,v)=>stores[1].reader.query(q,v),audit:{begin:async()=>({durable:true,authorizationRef:randomUUID(),expiresAt:new Date(Date.now()+60000).toISOString()}),complete:async v=>(complete=v,{durable:true,outputSha256:v.outputSha256}),failure:async()=>{}},now:Date.now})
   const out=await read.read();assert.equal(out.rows.length,10);assert.equal(complete.invocations.length,10)
   assert(!JSON.stringify(out).includes('SYNTHETIC_'));assert(!JSON.stringify(out).includes('correlationId'));assert(out.rows.every(r=>r.firstCheckpoint==='NOT_RECORDED'))
  })
  await t.test('actual missing Source EXECUTE withholds buffered private results',async()=>{
   const source=stores[1];await source.owner.query(`REVOKE EXECUTE ON FUNCTION profitia_sg2_d1_source.read_case(text) FROM ${source.readerRole}`)
   try{
    let completed=false
    const read=createFiveCaseReader({environment:'development',privateQuery:(q,v)=>stores[0].reader.query(q,v),sourceQuery:(q,v)=>source.reader.query(q,v),audit:{begin:async()=>({durable:true,authorizationRef:randomUUID(),expiresAt:new Date(Date.now()+60000).toISOString()}),complete:async()=>{completed=true},failure:async()=>{}},now:Date.now})
    await assert.rejects(read.read(),e=>e.message==='D1_READ_UNAVAILABLE');assert.equal(completed,false)
   }finally{await source.owner.query(`GRANT EXECUTE ON FUNCTION profitia_sg2_d1_source.read_case(text) TO ${source.readerRole}`)}
  })
  for(const s of stores){
   const query=()=>s.reader.query(`SELECT profitia_sg2_d1_${s.store}.read_case($1) AS result`,['C1'])
   await t.test(`${s.store}: fixed role, owner, RLS, ACL and search_path retained`,async()=>{
    const flags=(await s.owner.query(`SELECT rolsuper,rolbypassrls,rolinherit,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=$1`,[s.readerRole])).rows[0];assert(Object.values(flags).every(v=>v===false))
    const row=(await s.owner.query(`SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='${s.base}.security_events'::regclass`)).rows[0];assert(row.relrowsecurity&&row.relforcerowsecurity)
    const fn=(await s.owner.query(`SELECT proconfig,pg_get_userbyid(proowner) AS owner,prosecdef FROM pg_proc WHERE oid='profitia_sg2_d1_${s.store}.read_case(text)'::regprocedure`)).rows[0];assert(fn.prosecdef);assert.equal(fn.owner,s.ownerRole);assert(fn.proconfig.includes('search_path=pg_catalog, pg_temp'))
    await s.reader.query('SET search_path=pg_temp,public');assert.equal((await query()).rows[0].result.rows.length,1)
   })
   await t.test(`${s.store}: unknowncase/arbitrarytime/roleowner/rawJSON/PII/DML/bindingchange denied`,async()=>{
    for(const c of ['UNKNOWN',"H1' OR true --",'2026-01-01'])await assert.rejects(s.reader.query(`SELECT profitia_sg2_d1_${s.store}.read_case($1)`,[c]),e=>e.code==='42501')
    for(const sql of [`SELECT event FROM ${s.base}.security_events`,`SELECT decision_id FROM ${s.base}.security_events`,`UPDATE ${s.base}.runtime_bindings SET status='REVOKED'`,`DELETE FROM ${s.base}.security_events`,`INSERT INTO ${s.base}.security_events DEFAULT VALUES`,`TRUNCATE ${s.base}.security_events`,`SET ROLE ${s.ownerRole}`,`SELECT * FROM profitia_sg2_d1_${s.store}.authorization`])await assert.rejects(s.reader.query(sql),e=>['42501'].includes(e.code))
    await assert.rejects(s.owner.query(`SELECT profitia_sg2_d1_${s.store}.read_case('C1')`),e=>e.code==='42501') // owner execution cannot impersonate session_user
   })
   await t.test(`${s.store}: native execution LOG survives caller transaction rollback`,async()=>{
    const n=s.notices.length;await s.reader.query('BEGIN');const v=(await query()).rows[0].result;await s.reader.query('ROLLBACK')
    const notices=s.notices.slice(n);assert(notices.some(n=>n.includes(v.invocationRef)&&n.includes('phase=INTENT')));assert(notices.some(n=>n.includes(v.invocationRef)&&n.includes('phase=OUTCOME')))
    if(process.env.D1_LOCAL_POSTGRES_LOG){const b=fs.readFileSync(process.env.D1_LOCAL_POSTGRES_LOG,'utf8');assert(b.includes(v.invocationRef))}
   })
   await t.test(`${s.store}: unexpected role membership invalidates an existing reader`,async()=>{
    await admin.query(`GRANT ${s.ownerRole} TO ${s.readerRole}`)
    try{await assert.rejects(query(),e=>e.code==='42501')}
    finally{await admin.query(`REVOKE ${s.ownerRole} FROM ${s.readerRole}`)}
   })
   await t.test(`${s.store}: expiry and wrong environment deny without broadening E1`,async()=>{
    await s.owner.query(`UPDATE profitia_sg2_d1_${s.store}.authorization SET expires_at=clock_timestamp()-interval '1 second'`);await assert.rejects(query(),e=>e.code==='42501')
    await s.owner.query(`UPDATE profitia_sg2_d1_${s.store}.authorization SET expires_at=clock_timestamp()+interval '5 minutes'`)
    await s.owner.query(`UPDATE ${s.base}.installation SET environment='staging'`);await assert.rejects(query(),e=>e.code==='42501');await s.owner.query(`UPDATE ${s.base}.installation SET environment='development'`)
   })
   await t.test(`${s.store}: malformed reason cannot transmit payload`,async()=>{
    await s.insert(CASES[4],{reason:'SYNTHETIC_PERSON'});assert((await query()).rows[0].result.rows.some(r=>r.reasonCode===null));assert(!JSON.stringify((await query()).rows).includes('SYNTHETIC_PERSON'))
   })
   await t.test(`${s.store}:101rows fails closed, existing events unchanged by reads`,async()=>{
    for(let i=0;i<100;i++)await s.insert(CASES[0]);const before=(await s.owner.query(`SELECT count(*)::int AS n FROM ${s.base}.security_events`)).rows[0].n
    await assert.rejects(s.reader.query(`SELECT profitia_sg2_d1_${s.store}.read_case('H1')`),e=>e.code==='42501');assert.equal((await s.owner.query(`SELECT count(*)::int AS n FROM ${s.base}.security_events`)).rows[0].n,before)
   })
   await t.test(`${s.store}: revoke/NOLOGIN retains history and eliminates access`,async()=>{
    await s.owner.query('RESET ROLE');await s.owner.query(load(prefix+'expire.sql'));await assert.rejects(query(),e=>e.code==='42501')
    assert.equal((await s.owner.query('SELECT rolcanlogin FROM pg_roles WHERE rolname=$1',[s.readerRole])).rows[0].rolcanlogin,false)
    assert.deepEqual((await s.owner.query(`SELECT * FROM ${s.base}.installation`)).rows,s.before)
   })
  }
 }finally{
  for(const s of stores){await s.reader.end();await s.owner.end()}
  for(const database of created.reverse())await admin.query(`DROP DATABASE ${database} WITH (FORCE)`)
  for(const role of ['sg2_d1_private_denial_reader','sg2_d1_source_denial_reader'])if((await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await admin.query(`DROP ROLE ${role}`)
  await admin.query('SELECT pg_advisory_unlock(20261103,4101)');await admin.end()
 }
})
