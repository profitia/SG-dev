import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import {spawnSync} from 'node:child_process'
import pg from 'pg'
import {readQualityPublisherConnections,qualityPublisherRoleQuery,assertQualityPublisherRole,
 createQualityPublisherReadiness,readQualityPublisherPreflightEnvironment,runQualityNativePublisherPreflight} from '../src/publisher-readiness.mjs'
const source='d'.repeat(40),deadline='2026-11-27T23:59:59.000Z'
const urls={
 canonicalUrl:'postgresql://aqc_development_canonical_publisher:'+'a'.repeat(128)+'@ep-late-heart-b9mxo8oi.c-7.eu-central-1.aws.neon.tech/platform_private?sslmode=verify-full',
 productUrl:'postgresql://aqc_development_product_publisher:'+'b'.repeat(128)+'@ep-muddy-pine-b22pdyqd.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require',
}
const row=profile=>({database_name:profile==='canonical'?'platform_private':'neondb',role:'aqc_development_'+profile+'_publisher',
 login:'aqc_development_'+profile+'_publisher',rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false,
 rolinherit:false,rolreplication:false,rolcanlogin:true,rolconnlimit:2,rolvaliduntil:deadline,memberships:0,owner_member:false,
 schema_usage:true,schema_create:false,schema_grant_option:false,schema_confined:true,schema_tables:2,tables_confined:true,direct_table_access:false,direct_column_access:false,schema_functions:2,functions_confined:true})
function fixture(){
 const reads=[],roles={canonical:row('canonical'),product:row('product')},states={}
 for(const profile of ['canonical','product'])states[profile]={schemaVersion:'AQC_PUBLISHER_CAS_STATUS_V1',applicationId:'spendguru',
  environment:'development',profile,currentSourceSha:source,bindingsFresh:true,publishingEnabled:false,recoveryEnabled:true,
  authorisedUntil:deadline,operation:null,rawQaReadPerformed:false,permissionMutationPerformed:false}
 const query=profile=>async(sql,args)=>{reads.push({profile,sql,args})
  if(sql===qualityPublisherRoleQuery(profile))return {rows:[structuredClone(roles[profile])]}
  assert.equal(sql,'SELECT profitia_quality_release.quality_deployment_cas_status($1::uuid) AS result');assert.deepEqual(args,[null])
  return {rows:[{result:structuredClone(states[profile])}]}}
 const client=()=>createQualityPublisherReadiness({canonicalQuery:query('canonical'),productQuery:query('product'),now:()=>Date.parse('2026-11-19T00:00:00.000Z')})
 return {reads,roles,states,client}
}
test('publisher connections are fixed to both new ordinary roles with strict TLS',()=>{
 const c=readQualityPublisherConnections(urls)
 assert.equal(c.canonical.user,'aqc_development_canonical_publisher');assert.equal(c.product.database,'neondb')
 assert.equal(c.canonical.ssl.rejectUnauthorized,true);assert.equal(c.product.ssl.rejectUnauthorized,true)
 assert(Object.isFrozen(c)&&Object.isFrozen(c.canonical)&&Object.isFrozen(c.canonical.ssl))
 for(const mutation of [
  u=>u.replace('canonical_publisher','product_publisher'),u=>u.replace('ep-late-heart-b9mxo8oi','evil'),
  u=>u.replace('/platform_private','/neondb'),u=>u.replace('sslmode=verify-full','sslmode=disable'),
  u=>u+'&options=-c%20role%3Dprofitia_access_owner',u=>u+'&sslmode=require',u=>u+'#fragment',
  u=>u.replace('.tech/','.tech:6543/'),u=>u+'&channel_binding=disable',u=>u.replace('postgresql:','https:'),
 ])assert.throws(()=>readQualityPublisherConnections({...urls,canonicalUrl:mutation(urls.canonicalUrl)}))
 assert.throws(()=>readQualityPublisherConnections({...urls,query:()=>{}}))
 let got=0;const hostile={...urls};Object.defineProperty(hostile,'canonicalUrl',{enumerable:true,get(){got++;return urls.canonicalUrl}})
 assert.throws(()=>readQualityPublisherConnections(hostile));assert.equal(got,0)
})
test('publisher role qualification rejects escalation, table rights, public execute and widened expiry',()=>{
 for(const profile of ['canonical','product']){
  assertQualityPublisherRole(profile,[row(profile)],Date.parse('2026-11-19T00:00:00Z'))
  for(const [k,v]of Object.entries({rolsuper:true,rolbypassrls:true,rolcreatedb:true,rolcreaterole:true,rolinherit:true,
   rolreplication:true,rolcanlogin:false,rolconnlimit:3,memberships:1,owner_member:true,schema_create:true,
   schema_usage:false,schema_grant_option:true,schema_confined:false,schema_tables:3,tables_confined:false,direct_table_access:true,direct_column_access:true,schema_functions:3,functions_confined:false,
   database_name:'other',login:'neondb_owner',role:'neondb_owner',rolvaliduntil:'2026-11-28T00:00:00.000Z'})){
   assert.throws(()=>assertQualityPublisherRole(profile,[{...row(profile),[k]:v}],Date.parse('2026-11-19T00:00:00Z')),{code:'PUBLISHER_PREFLIGHT_ROLE_INVALID'})
  }
  assert.throws(()=>assertQualityPublisherRole(profile,[row(profile)],Date.parse(deadline)),{code:'PUBLISHER_PREFLIGHT_EXPIRED'})
 }
})
test('publisher readiness exposes metadata only and never a release or CAS mutation port',async()=>{
 const f=fixture(),client=f.client(),r=await client.check({sourceSha:source})
 assert.equal(r.status,'PUBLISHER_CONNECTED_DISABLED');assert.equal(r.profilesVerified,2);assert.equal(r.bindingsVerified,6)
 assert.equal(r.publishingEnabled,false);assert.equal(r.rawQaReadPerformed,false);assert.equal(r.updatedBindings,0)
 assert.deepEqual(Object.keys(client),['check']);assert.equal(f.reads.length,4)
 assert.equal(Object.isFrozen(r),true);assert(!JSON.stringify(r).includes('password'))
 const g=fixture();await assert.rejects(g.client().check({sourceSha:source,sql:'UPDATE anything'}));assert.equal(g.reads.length,0)
})
test('native disabled policy is checked independently of the wrapper promotion switch',async()=>{
 const f=fixture();f.states.product.publishingEnabled=true
 await assert.rejects(f.client().check({sourceSha:source}),{code:'PUBLISHER_BINDING_READ_UNAVAILABLE'})
 assert.equal(f.reads.length,4)
})
test('foreign bindings, stale rights, private additions and incomplete roles fail readiness',async()=>{
 for(const change of [
  f=>f.states.product.currentSourceSha='e'.repeat(40),f=>f.states.canonical.bindingsFresh=false,
  f=>f.states.product.rawQaReadPerformed=true,f=>f.states.product.privateRows=[],
  f=>f.roles.product.rolsuper=true,
 ]){
  const f=fixture();change(f);await assert.rejects(f.client().check({sourceSha:source}))
 }
})
const nativeEnv=()=>({...urls,AQC_PUBLISHER_CANONICAL_DATABASE_URL:urls.canonicalUrl,AQC_PUBLISHER_PRODUCT_DATABASE_URL:urls.productUrl,
 GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',RUNNER_OS:'Linux',GITHUB_EVENT_NAME:'workflow_dispatch',
 GITHUB_REPOSITORY:'profitia/SG-dev',GITHUB_REF:'refs/heads/main',GITHUB_ACTOR:'profitia',GITHUB_TRIGGERING_ACTOR:'profitia',
 GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'12345',GITHUB_SHA:'c'.repeat(40),
 GITHUB_WORKFLOW_REF:'profitia/SG-dev/.github/workflows/assistant-quality-repair.yml@refs/heads/main',
 TARGET_ENVIRONMENT:'development',AQC_PAID_REPAIRS_ENABLED:'false',AQC_PROMOTION_ENABLED:'false',
 AQC_NONCE:randomUUID(),AQC_HOST_SOURCE_SHA:source})
test('native preflight rejects foreign invocation and unnecessary secrets before network access',async()=>{
 const good=nativeEnv();assert.equal(readQualityPublisherPreflightEnvironment(good).hostSourceSha,source)
 for(const [key,value]of Object.entries({GITHUB_REF:'refs/pull/1/merge',GITHUB_REPOSITORY:'other/SG-dev',
  GITHUB_ACTOR:'other',GITHUB_TRIGGERING_ACTOR:'other',GITHUB_EVENT_NAME:'pull_request',GITHUB_RUN_ATTEMPT:'2',
  RUNNER_ENVIRONMENT:'self-hosted',GITHUB_WORKFLOW_REF:'other',AQC_PAID_REPAIRS_ENABLED:'true',AQC_PROMOTION_ENABLED:'true'})){
  assert.throws(()=>readQualityPublisherPreflightEnvironment({...good,[key]:value}),{code:'PUBLISHER_PREFLIGHT_NATIVE_INVOCATION_REQUIRED'})
 }
 for(const key of ['OPENAI_API_KEY','AQC_RENDER_PUBLISHER_API_KEY','AQC_OWNER_PRIVATE_KEY','AQC_INDEPENDENT_PUBLISHER_PRIVATE_KEY','AQC_QA_STORAGE_KEY','DATABASE_URL'])
  assert.throws(()=>readQualityPublisherPreflightEnvironment({...good,[key]:'PRIVATE_DO_NOT_LOG'}),{code:'PUBLISHER_PREFLIGHT_SECRET_SCOPE_REJECTED'})
 await assert.rejects(runQualityNativePublisherPreflight({query:()=>{throw Error('must not run')}}),{code:'PUBLISHER_PREFLIGHT_INPUTS_FORBIDDEN'})
 const old=process.env.GITHUB_ACTIONS;delete process.env.GITHUB_ACTIONS
 try{await assert.rejects(runQualityNativePublisherPreflight(),{code:'PUBLISHER_PREFLIGHT_NATIVE_INVOCATION_REQUIRED'})}
 finally{if(old!==undefined)process.env.GITHUB_ACTIONS=old}
})

const fixtureCommand=(command,args)=>{
 const r=spawnSync(command,args,{encoding:'utf8',timeout:60000})
 if(r.error||r.status!==0)throw Error('Isolated publisher PostgreSQL fixture command failed')
 return r.stdout.trim()
}
async function publisherCatalogFixture(profile){
 // Only a freshly created loopback cluster. This fixture accepts no URL,
 // cloud connection, password, grant callback or existing database.
 const bin=process.env.AQC_TEST_POSTGRES_BIN??fixtureCommand('pg_config',['--bindir'])
 assert(path.isAbsolute(bin)&&path.resolve(bin)===bin)
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aqc-publisher-role-catalog-'))
 const data=path.join(root,'data'),sock=path.join(root,'socket');fs.mkdirSync(sock)
 const probe=net.createServer();await new Promise((resolve,reject)=>probe.once('error',reject).listen(0,'127.0.0.1',resolve))
 const port=probe.address().port;await new Promise(resolve=>probe.close(resolve))
 const pools=[],connections=new Set();let started=false
 const close=async()=>{
  await Promise.all(pools.map(p=>p.end()))
  await Promise.all([...connections].map(s=>s.closed?undefined:new Promise(resolve=>s.once('close',resolve))))
  if(started){fixtureCommand(path.join(bin,'pg_ctl'),['-D',data,'-w','stop','-m','fast']);started=false}
  fs.rmSync(root,{recursive:true,force:true})
 }
 try{
  fixtureCommand(path.join(bin,'initdb'),['-D',data,'-U','aqc_fixture_owner','--auth-local=trust','--auth-host=trust','--encoding=UTF8','--no-locale'])
  fixtureCommand(path.join(bin,'pg_ctl'),['-D',data,'-l',path.join(root,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -k ${sock}`,'-w','start']);started=true
  const database=profile==='canonical'?'platform_private':'neondb'
  const owner=profile==='canonical'?'profitia_access_owner':'profitia_ingestion_owner'
  const role='aqc_development_'+profile+'_publisher'
  const pool=(user,db)=>{
   const p=new pg.Pool({host:'127.0.0.1',port,user,database:db,max:1})
   p.on('connect',client=>{const s=client.connection.stream;connections.add(s);s.once('close',()=>connections.delete(s))})
   pools.push(p);return p
  }
  const bootstrap=pool('aqc_fixture_owner','postgres');await bootstrap.query('CREATE DATABASE '+database)
  const admin=pool('aqc_fixture_owner',database)
  await admin.query('CREATE ROLE '+owner+' NOLOGIN NOINHERIT;CREATE ROLE '+role+
   " LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION CONNECTION LIMIT 2 VALID UNTIL '2026-11-27T23:59:59Z'")
  await admin.query('CREATE SCHEMA profitia_quality_release AUTHORIZATION '+owner+';REVOKE ALL ON SCHEMA profitia_quality_release FROM PUBLIC;SET ROLE '+owner)
  await admin.query('CREATE TABLE profitia_quality_release.quality_deployment_cas_policy(a int,b int);CREATE TABLE profitia_quality_release.quality_deployment_cas_operations(a int,b int)')
  const signatures=['quality_deployment_cas(uuid,text,text,uuid,timestamptz)','quality_deployment_cas_status(uuid)']
  for(const f of signatures){
   await admin.query('CREATE FUNCTION profitia_quality_release.'+f+" RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$SELECT '{}'::jsonb$$")
   await admin.query('REVOKE ALL ON FUNCTION profitia_quality_release.'+f+' FROM PUBLIC;GRANT EXECUTE ON FUNCTION profitia_quality_release.'+f+' TO '+role)
  }
  await admin.query('REVOKE ALL ON ALL TABLES IN SCHEMA profitia_quality_release FROM PUBLIC;GRANT USAGE ON SCHEMA profitia_quality_release TO '+role+';RESET ROLE')
  const reader=pool(role,database),read=async()=>(await reader.query(qualityPublisherRoleQuery(profile))).rows
  return {admin,role,owner,signatures,read,close}
 }catch(error){await close();throw error}
}
for(const profile of ['canonical','product']){
 test('native '+profile+' publisher catalog rejects column-only rights and grant options without changing Development',async()=>{
  const f=await publisherCatalogFixture(profile),at=Date.parse('2026-11-19T00:00:00Z')
  const valid=async()=>assertQualityPublisherRole(profile,await f.read(),at)
  try{
   await valid()
   for(const table of ['quality_deployment_cas_policy','quality_deployment_cas_operations'])
    for(const privilege of ['SELECT','INSERT','UPDATE','REFERENCES']){
     await f.admin.query('GRANT '+privilege+'(a) ON TABLE profitia_quality_release.'+table+' TO '+f.role)
     const rows=await f.read()
     assert.equal(rows[0].direct_table_access,false,'column-only access is invisible to table-level inspection')
     assert.equal(rows[0].direct_column_access,true)
     assert.throws(()=>assertQualityPublisherRole(profile,rows,at),{code:'PUBLISHER_PREFLIGHT_ROLE_INVALID'})
     await f.admin.query('REVOKE '+privilege+'(a) ON TABLE profitia_quality_release.'+table+' FROM '+f.role);await valid()
    }
   await f.admin.query('GRANT USAGE ON SCHEMA profitia_quality_release TO '+f.role+' WITH GRANT OPTION')
   const schemaRows=await f.read();assert.equal(schemaRows[0].schema_usage,true);assert.equal(schemaRows[0].schema_grant_option,true)
   assert.throws(()=>assertQualityPublisherRole(profile,schemaRows,at),{code:'PUBLISHER_PREFLIGHT_ROLE_INVALID'})
   await f.admin.query('REVOKE GRANT OPTION FOR USAGE ON SCHEMA profitia_quality_release FROM '+f.role);await valid()
   for(const signature of f.signatures){
    await f.admin.query('GRANT EXECUTE ON FUNCTION profitia_quality_release.'+signature+' TO '+f.role+' WITH GRANT OPTION')
    const rows=await f.read();assert.equal(rows[0].functions_confined,false)
    assert.throws(()=>assertQualityPublisherRole(profile,rows,at),{code:'PUBLISHER_PREFLIGHT_ROLE_INVALID'})
    await f.admin.query('REVOKE GRANT OPTION FOR EXECUTE ON FUNCTION profitia_quality_release.'+signature+' FROM '+f.role);await valid()
   }
   for(const table of ['quality_deployment_cas_policy','quality_deployment_cas_operations']){
    await f.admin.query('ALTER TABLE profitia_quality_release.'+table+' OWNER TO '+f.role)
    await f.admin.query('REVOKE ALL ON TABLE profitia_quality_release.'+table+' FROM '+f.role)
    const rows=await f.read()
    assert.equal(rows[0].direct_table_access,false);assert.equal(rows[0].direct_column_access,false)
    assert.equal(rows[0].tables_confined,false,'ownership remains authority after ordinary privileges are revoked')
    assert.throws(()=>assertQualityPublisherRole(profile,rows,at),{code:'PUBLISHER_PREFLIGHT_ROLE_INVALID'})
    await f.admin.query('ALTER TABLE profitia_quality_release.'+table+' OWNER TO '+f.owner);await valid()
   }
   await f.admin.query('ALTER SCHEMA profitia_quality_release OWNER TO '+f.role)
   const schemaOwnerRows=await f.read();assert.equal(schemaOwnerRows[0].schema_confined,false)
   assert.throws(()=>assertQualityPublisherRole(profile,schemaOwnerRows,at),{code:'PUBLISHER_PREFLIGHT_ROLE_INVALID'})
   // ALTER OWNER rewrites owner ACL entries; restore the fixture's original
   // ordinary USAGE grant after returning the schema to its approved owner.
   await f.admin.query('ALTER SCHEMA profitia_quality_release OWNER TO '+f.owner)
   await f.admin.query('GRANT USAGE ON SCHEMA profitia_quality_release TO '+f.role);await valid()
  }finally{await f.close()}
 })
}
