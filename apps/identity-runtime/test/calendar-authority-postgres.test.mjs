// SYNTHETIC_ONLY: current central E1 and signed proof checks in real PostgreSQL.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {randomUUID,createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import pg from 'pg'
import {calendarE1Fixture,A,U} from '../../../packages/platform-contracts/test/fixtures/calendar-current-e1-postgres.mjs'
const sql=readFileSync(new URL('../../../packages/platform-contracts/current-e1-authority/migrations/015-calendar-delivery.sql',import.meta.url),'utf8')
const hash=v=>createHash('sha256').update(v).digest('hex')
async function isolatedCalendarFixture(){
 const bin=process.env.B1_PG_BIN??(existsSync('/opt/homebrew/opt/postgresql@16/bin/initdb')?'/opt/homebrew/opt/postgresql@16/bin':'/usr/lib/postgresql/16/bin')
 if(process.env.OPERATION_FIXTURE_OWNER_URL||process.env.SOURCE_HUB_TEST_ADMIN_URL||existsSync(bin+'/initdb')){
  process.env.B1_PG_BIN??=bin;return calendarE1Fixture()
 }
 // Same ephemeral PostgreSQL16 fallback as the existing Identity profile tests.
 // No cloud resources, external database, credentials or skipped assertions.
 const run=(args)=>spawnSync('docker',args,{encoding:'utf8',timeout:120000})
 const started=run(['run','--detach','--rm','--publish','127.0.0.1::5432','--env','POSTGRES_USER=calendar_fixture_operator','--env','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16']),container=started.stdout?.trim()
 if(started.status!==0||!/^[a-f0-9]{64}$/.test(container??''))throw Error('SYNTHETIC_CALENDAR_POSTGRES_REQUIRED')
 const previous=process.env.OPERATION_FIXTURE_OWNER_URL,stop=()=>run(['rm','--force',container])
 try{
  const port=run(['port',container,'5432/tcp']).stdout?.trim()
  if(!/^127\.0\.0\.1:[0-9]+$/.test(port??''))throw Error('SYNTHETIC_CALENDAR_LOOPBACK_ONLY')
  let ready=false
  for(let i=0;i<60;i++){
   if(run(['exec',container,'pg_isready','-h','127.0.0.1','-U','calendar_fixture_operator','-d','postgres','-t','1']).status===0){ready=true;break}
   await new Promise(resolve=>setTimeout(resolve,500))
  }
  if(!ready)throw Error('SYNTHETIC_CALENDAR_POSTGRES_NOT_READY')
  process.env.OPERATION_FIXTURE_OWNER_URL='postgresql://calendar_fixture_operator@'+port+'/postgres'
  const f=await calendarE1Fixture(),close=f.close
  return{...f,async close(){try{await close()}finally{stop()}}}
 }catch(error){stop();throw error}
 finally{if(previous===undefined)delete process.env.OPERATION_FIXTURE_OWNER_URL;else process.env.OPERATION_FIXTURE_OWNER_URL=previous}
}
test('current calendar delivery requires its own admitted purpose and both live rights; proof revokes immediately',async()=>{
 const f=await isolatedCalendarFixture()
 try{
  const request={applicationId:f.calendar.configuration.applicationId,deliveryId:randomUUID(),leaseId:randomUUID(),nonce:'a'.repeat(64),organisationId:A,ownerUserId:U,eventId:'ecr_evt_'+'b'.repeat(64),payloadDigest:'c'.repeat(64)}
  const q=f.db(0).query,one=async(s,v=[])=>Object.values((await q(s,v)).rows[0])[0]
  await f.asOwner(0,async t=>{
   await t.query(sql)
   await t.query('INSERT INTO profitia_e1_authority.calendar_delivery_installation VALUES(true,$1)',[hash(sql)])
   for(const sig of ['calendar_delivery_descriptor()','calendar_delivery_identity(jsonb)','calendar_delivery_proof(jsonb,jsonb,text)','calendar_delivery_verify(jsonb)'])await t.query('GRANT EXECUTE ON FUNCTION profitia_e1_authority.'+sig+' TO identity_b1_runtime')
  })
  assert.equal(await one('SELECT profitia_e1_authority.calendar_delivery_identity($1)',[request]),null)
  await f.asOwner(0,t=>t.query("INSERT INTO profitia_e1_authority.calendar_delivery_policies VALUES($1,'identity_b1_runtime','SYNTHETIC_ONLY_CALENDAR_MAIL','https://dev-sg2.spendguru.app','ACTIVE',1,clock_timestamp()+interval '1 hour','SYNTHETIC_ONLY')",[request.applicationId]))
  const identity=await one('SELECT profitia_e1_authority.calendar_delivery_identity($1)',[request]);assert.equal(identity.subject,'user_'+U)
  const observation={environment:'development',issuer:identity.issuer,subject:identity.subject,status:'ACTIVE',observedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+4000).toISOString()}
  const proof=await one('SELECT profitia_e1_authority.calendar_delivery_proof($1,$2,$3)',[request,observation,'d'.repeat(64)]);assert(proof)
  assert.equal((await one('SELECT profitia_e1_authority.calendar_delivery_verify($1)',[proof])).recipientDigest,'d'.repeat(64))
  for(const altered of [{...proof,signature:'0'.repeat(64)},{...proof,payload:JSON.stringify({...JSON.parse(proof.payload),request:{...request,ownerUserId:randomUUID()}})}])await assert.rejects(one('SELECT profitia_e1_authority.calendar_delivery_verify($1)',[altered]),{code:'42501'})
  assert.equal(await one('SELECT profitia_e1_authority.calendar_delivery_proof($1,$2,$3)',[request,{...observation,subject:'foreign'},'d'.repeat(64)]),null)
  await f.asOwner(0,t=>t.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature,resource_id) VALUES($1,$2,$3,$4,'DENY','personal.list.read','personal_workspace','economic-calendar-preferences')",[randomUUID(),request.applicationId,A,U]))
  assert.equal(await one('SELECT profitia_e1_authority.calendar_delivery_identity($1)',[request]),null)
  await assert.rejects(one('SELECT profitia_e1_authority.calendar_delivery_verify($1)',[proof]),{code:'42501'})
  const untrusted=new pg.Client({...f.databases[0].connectionParameters,user:'economic_calendar_development_ingest',password:'SYNTHETIC_ONLY_NOT_A_REAL_CREDENTIAL'})
  await untrusted.connect();try{await assert.rejects(untrusted.query('SELECT profitia_e1_authority.calendar_delivery_identity($1)',[request]),{code:'42501'})}finally{await untrusted.end()}
 }finally{await f.close()}
})
