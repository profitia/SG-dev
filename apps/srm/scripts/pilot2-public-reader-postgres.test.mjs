import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {pilot2PublicReaderPlan} from './pilot2-human-installation.mjs'
const {Client}=createRequire(new URL('../package.json',import.meta.url))('pg')
const fixture=process.env.PILOT2_READER_FIXTURE_URL

test('PILOT2 public reader: actual SCRAM, public column reads, private-table/write/role denial and preserved legacy rollback privileges',{skip:!fixture},async()=>{
 const u=new URL(fixture)
 if(!['127.0.0.1','localhost'].includes(u.hostname)||!u.port||u.port==='5432'
  ||u.username!=='neondb_owner'||u.pathname!=='/srm_app')throw Error('Explicit disposable local public-reader fixture required')
 const owner=new Client({connectionString:u.href});await owner.connect()
 let reader,legacy
 try{
  assert.equal((await owner.query("SELECT to_regnamespace('srm') AS schema")).rows[0].schema,null,'Never adopt existing data')
  await owner.query("CREATE ROLE srm_app_runtime LOGIN PASSWORD 'LegacyFixtureOnly09_0123456789abcdef' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS")
  const manifest=JSON.parse(fs.readFileSync(new URL('../db/private-store/manifest.json',import.meta.url)))
  assert.equal(manifest.migrations.length,18)
  for(const entry of manifest.migrations){
   const sql=fs.readFileSync(new URL('../db/migrations/'+entry.version+'.sql',import.meta.url),'utf8')
   assert.equal(createHash('sha256').update(sql).digest('hex'),entry.checksum)
   await owner.query(sql)
  }
  // Existing runtime-permissions onboarding supplies this separately from
  // historical migrations; reproduce that already present baseline ACL.
  await owner.query('GRANT USAGE ON SCHEMA srm TO srm_app_runtime')
  const roleUrl=(role,password)=>{const url=new URL(u);url.username=role;url.password=password;return url.href}
  legacy=new Client({connectionString:roleUrl('srm_app_runtime','LegacyFixtureOnly09_0123456789abcdef')});await legacy.connect()
  await legacy.query('BEGIN')
  await legacy.query("SELECT set_config('srm.organization_id','11111111-1111-4111-8111-111111111111',true)")
  await legacy.query("INSERT INTO srm.catalog_companies(nip,general_json,general_sha256,general_checked_at) VALUES('7820021192',$1::jsonb,$2,clock_timestamp())",[JSON.stringify({publicFixture:'SYNTHETIC_ONLY'}),'a'.repeat(64)])
  await legacy.query('COMMIT')
  const before=(await legacy.query("SELECT has_database_privilege(current_user,current_database(),'CONNECT') c,has_database_privilege(current_user,current_database(),'TEMP') t")).rows[0]
  const plan=pilot2PublicReaderPlan('a'.repeat(40))
  await owner.query('BEGIN')
  try{
   for(const sql of plan.beforeCredentials)await owner.query(sql)
   await owner.query("ALTER ROLE srm_pilot2_catalog_reader PASSWORD 'ReaderFixtureOnly09_0123456789abcdef'")
   for(const sql of plan.afterCredentials)await owner.query(sql)
   await owner.query('COMMIT')
  }catch(error){await owner.query('ROLLBACK');throw error}
  reader=new Client({connectionString:roleUrl('srm_pilot2_catalog_reader','ReaderFixtureOnly09_0123456789abcdef')});await reader.connect()
  assert.equal((await reader.query('SELECT general_json FROM srm.catalog_companies WHERE nip=$1',['7820021192'])).rows[0].general_json.publicFixture,'SYNTHETIC_ONLY')
  const flags=(await reader.query('SELECT rolbypassrls,rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolconnlimit FROM pg_roles WHERE rolname=current_user')).rows[0]
  assert.deepEqual(flags,{rolbypassrls:false,rolsuper:false,rolinherit:false,rolcreatedb:false,rolcreaterole:false,rolconnlimit:4})
  for(const table of['lookup_requests','users','source_snapshots','mgbi_source_archives','financial_source_documents','financial_scanner_frames','catalog_kys_reports'])await assert.rejects(reader.query('SELECT * FROM srm.'+table+' LIMIT 1'),e=>e.code==='42501',table)
  await assert.rejects(reader.query('SELECT general_source_organization_id FROM srm.catalog_companies'),e=>e.code==='42501','Private source-owner annotation is not in the column grant')
  await assert.rejects(reader.query("INSERT INTO srm.catalog_companies(nip) VALUES('7772776017')"),e=>e.code==='42501')
  await assert.rejects(reader.query("UPDATE srm.catalog_companies SET financial_checked_at=clock_timestamp() WHERE nip='7820021192'"),e=>e.code==='42501','Cannot renew freshness')
  await assert.rejects(reader.query('CREATE TEMP TABLE forbidden(id int)'),e=>e.code==='42501')
  await assert.rejects(reader.query('SET ROLE srm_app_runtime'),e=>e.code==='42501')
  await assert.rejects(reader.query('SET ROLE neondb_owner'),e=>e.code==='42501')
  const wrong=new Client({connectionString:roleUrl('srm_pilot2_catalog_reader','IncorrectFixturePassword')})
  try{await assert.rejects(wrong.connect(),e=>e.code==='28P01')}finally{await wrong.end()}
  assert.deepEqual((await legacy.query("SELECT has_database_privilege(current_user,current_database(),'CONNECT') c,has_database_privilege(current_user,current_database(),'TEMP') t")).rows[0],before)
  assert.equal((await reader.query('SELECT count(*)::int n FROM srm.catalog_companies')).rows[0].n,1)
 }finally{await reader?.end();await legacy?.end();await owner.end()}
})
