import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import {pilot2SourceBootstrapPlan,applyPilot2SourceBootstrap} from './pilot2-source-installation.mjs'
const {Pool}=createRequire(new URL('../package.json',import.meta.url))('pg')
const target=JSON.parse(fs.readFileSync(new URL('../deployment/pilot2-registry-targets.json',import.meta.url)))
const fixture=process.env.PILOT2_SOURCE_FIXTURE_URL
test('PILOT2 Source installs atomically with ordinary roles and no account directory', {skip:!fixture},async()=>{
 const u=new URL(fixture)
 if(!['127.0.0.1','localhost'].includes(u.hostname)||!u.port||u.port==='5432'
  ||u.username!=='neondb_owner'||u.pathname!=='/krs_registry_pilot')throw Error('Explicit disposable local Source fixture required')
 const operator=new Pool({connectionString:u.href,max:1,connectionTimeoutMillis:2000})
 const initialPasswords={krs_reader:'FixtureOnlyReader09_0123456789abcdef0123456789abcdef',krs_ingest:'FixtureOnlySource09_0123456789abcdef0123456789abcdef'}
 let reader,source,business
 try{
  const client=await operator.connect()
  try{
   const flags=(await client.query('SELECT rolsuper,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=current_user')).rows[0]
   assert.deepEqual(flags,{rolsuper:false,rolcreaterole:true,rolcreatedb:true})
   // Running a plan without the credential initializer must roll back safely.
   await client.query('BEGIN')
   await assert.rejects(async()=>{for(const sql of pilot2SourceBootstrapPlan(target,'a'.repeat(40)).statements)await client.query(sql)},e=>e.code==='P0001')
   await client.query('ROLLBACK')
   assert.equal((await client.query("SELECT count(*)::int AS n FROM pg_roles WHERE rolname IN('krs_reader','krs_ingest','pilot2_source_bootstrap')")).rows[0].n,0)
   const applied=await applyPilot2SourceBootstrap(client,target,'a'.repeat(40),initialPasswords)
   assert.equal(applied.credentialsInitializedBeforeCleanup,true)
  }finally{client.release()}
  // Independent connections verify the committed cleanup and actual ACLs.
  const members=(await operator.query("SELECT rolname,pg_has_role(current_user,oid,'MEMBER') member,pg_has_role(current_user,oid,'SET') can_set FROM pg_roles WHERE rolname IN('krs_catalog_owner','profitia_ingestion_owner','krs_reader','krs_ingest') ORDER BY rolname")).rows
  assert.equal(members.length,4);assert(members.every(r=>!r.member&&!r.can_set))
  assert.equal((await operator.query("SELECT to_regnamespace('profitia_access')::text AS namespace")).rows[0].namespace,null)
  // No fixture superuser repairs the roles after cleanup. The same ordinary
  // operator initialized them inside the actual installation transaction.
  const roleUrl=role=>{const url=new URL(u);url.username=role;url.password=initialPasswords[role];return url.href}
  reader=new Pool({connectionString:roleUrl('krs_reader'),max:1,connectionTimeoutMillis:2000});source=new Pool({connectionString:roleUrl('krs_ingest'),max:1,connectionTimeoutMillis:2000})
  const wrong=new URL(roleUrl('krs_reader'));wrong.password='IncorrectFixtureCredentialOnly'
  const rejected=new Pool({connectionString:wrong.href,max:1,connectionTimeoutMillis:2000})
  try{await assert.rejects(rejected.query('SELECT current_user'),e=>e.code==='28P01')}finally{await rejected.end()}
  for(const pool of [reader,source]){
   const row=(await pool.query('SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolinherit,rolconnlimit FROM pg_roles WHERE rolname=current_user')).rows[0]
   assert.deepEqual(row,{rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false,rolinherit:false,rolconnlimit:4})
   await assert.rejects(pool.query('SET ROLE profitia_ingestion_owner'),e=>e.code==='42501')
   await assert.rejects(pool.query('CREATE TABLE krs_registry.forbidden(id int)'),e=>e.code==='42501')
   await assert.rejects(pool.query('SELECT * FROM profitia_ingestion.runtime_bindings'),e=>e.code==='42501')
  }
  assert.equal((await reader.query('SELECT count(*)::int AS count FROM krs_registry.snapshots')).rows[0].count,0)
  const write="INSERT INTO krs_registry.companies(krs,entity_key,state) VALUES('0000000001','PL:KRS:0000000001','UNKNOWN')"
  await assert.rejects(reader.query(write),e=>e.code==='42501')
  await assert.rejects(source.query(write),e=>e.code==='42501')
  for(const [name,resource]of [['krs.registry.gus','krs-gus:nip-map'],['krs.registry.official','krs-official:current']]){
   const d=(await source.query('SELECT profitia_external_native.descriptor($1,$2) AS descriptor',[name,resource])).rows[0].descriptor
   assert(d,name);assert.equal(d.quotaMode,'UNMETERED');assert.equal(d.capacity,null)
   assert.equal(d.applicationId,'krs-registry-source');assert.equal(d.role,'krs_ingest')
   assert.equal(d.nativeCredentialMode,name==='krs.registry.gus'?'SERVER_HEADERS':'NONE')
  }
  for(let i=0;i<3;i++)assert.equal((await source.query('SELECT profitia_external_native.reserve_gus_slot() AS wait')).rows[0].wait,0)
  assert((await source.query('SELECT profitia_external_native.reserve_gus_slot() AS wait')).rows[0].wait>0)
  await operator.query('CREATE DATABASE srm_app OWNER neondb_owner')
  const businessUrl=new URL(u);businessUrl.pathname='/srm_app'
  business=new Pool({connectionString:businessUrl.href,max:1})
  await business.query(`CREATE SCHEMA srm;CREATE TABLE srm.provider_attempts(section text,provider text,
    CONSTRAINT provider_attempts_provider_check CHECK (provider IN ('MGBI','VERCLY','CEIDG')),
    CONSTRAINT provider_attempts_check CHECK ((section='kys' AND provider='VERCLY') OR
     (section IN ('general','financial') AND provider='MGBI') OR (section='jdg' AND provider='CEIDG')))`)
  const migration=fs.readFileSync(new URL('../deployment/pilot2-registry-schema.sql',import.meta.url),'utf8')
  await assert.rejects(business.query(migration),e=>e.code==='P0001')
  await business.query('BEGIN')
  try{
   await business.query("SELECT set_config('profitia.install.pilot2_target','srv-dbeh6srrjlhs73fmikrg:br-summer-rain-b1nwbcbr:development',true)")
   await business.query(migration);await business.query('COMMIT')
  }catch(error){await business.query('ROLLBACK');throw error}
  await business.query("INSERT INTO srm.provider_attempts VALUES('general','KRS'),('general','MGBI'),('financial','MGBI'),('jdg','CEIDG'),('kys','VERCLY')")
  await assert.rejects(business.query("INSERT INTO srm.provider_attempts VALUES('financial','KRS')"),e=>e.code==='23514')
 }finally{await Promise.all([operator.end(),reader?.end(),source?.end(),business?.end()])}
})
