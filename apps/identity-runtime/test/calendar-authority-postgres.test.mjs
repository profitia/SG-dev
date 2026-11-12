// SYNTHETIC_ONLY: current central E1 and signed proof checks in real PostgreSQL.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {randomUUID,createHash} from 'node:crypto'
import {fixture,A,U} from '../../economic-calendar-runtime/test/fixtures.mjs'
const sql=readFileSync(new URL('../../../packages/platform-contracts/current-e1-authority/migrations/015-calendar-delivery.sql',import.meta.url),'utf8')
const hash=v=>createHash('sha256').update(v).digest('hex')
test('current calendar delivery requires its own admitted purpose and both live rights; proof revokes immediately',async()=>{
 const f=await fixture({seed:false})
 try{
  const request={applicationId:f.configuration.applicationId,deliveryId:randomUUID(),leaseId:randomUUID(),nonce:'a'.repeat(64),organisationId:A,ownerUserId:U,eventId:'ecr_evt_'+'b'.repeat(64),payloadDigest:'c'.repeat(64)}
  const q=f.e1.db(0).query,one=async(s,v=[])=>Object.values((await q(s,v)).rows[0])[0]
  await f.e1.asOwner(0,async t=>{
   await t.query(sql)
   await t.query('INSERT INTO profitia_e1_authority.calendar_delivery_installation VALUES(true,$1)',[hash(sql)])
   for(const sig of ['calendar_delivery_descriptor()','calendar_delivery_identity(jsonb)','calendar_delivery_proof(jsonb,jsonb,text)','calendar_delivery_verify(jsonb)'])await t.query('GRANT EXECUTE ON FUNCTION profitia_e1_authority.'+sig+' TO identity_b1_runtime')
  })
  assert.equal(await one('SELECT profitia_e1_authority.calendar_delivery_identity($1)',[request]),null)
  await f.e1.asOwner(0,t=>t.query("INSERT INTO profitia_e1_authority.calendar_delivery_policies VALUES($1,'identity_b1_runtime','SYNTHETIC_ONLY_CALENDAR_MAIL','https://dev-sg2.spendguru.app','ACTIVE',1,clock_timestamp()+interval '1 hour','SYNTHETIC_ONLY')",[request.applicationId]))
  const identity=await one('SELECT profitia_e1_authority.calendar_delivery_identity($1)',[request]);assert.equal(identity.subject,'user_'+U)
  const observation={environment:'development',issuer:identity.issuer,subject:identity.subject,status:'ACTIVE',observedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+4000).toISOString()}
  const proof=await one('SELECT profitia_e1_authority.calendar_delivery_proof($1,$2,$3)',[request,observation,'d'.repeat(64)]);assert(proof)
  assert.equal((await one('SELECT profitia_e1_authority.calendar_delivery_verify($1)',[proof])).recipientDigest,'d'.repeat(64))
  for(const altered of [{...proof,signature:'0'.repeat(64)},{...proof,payload:JSON.stringify({...JSON.parse(proof.payload),request:{...request,ownerUserId:randomUUID()}})}])await assert.rejects(one('SELECT profitia_e1_authority.calendar_delivery_verify($1)',[altered]),{code:'42501'})
  assert.equal(await one('SELECT profitia_e1_authority.calendar_delivery_proof($1,$2,$3)',[request,{...observation,subject:'foreign'},'d'.repeat(64)]),null)
  await f.e1.asOwner(0,t=>t.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature,resource_id) VALUES($1,$2,$3,$4,'DENY','personal.list.read','personal_workspace','economic-calendar-preferences')",[randomUUID(),request.applicationId,A,U]))
  assert.equal(await one('SELECT profitia_e1_authority.calendar_delivery_identity($1)',[request]),null)
  await assert.rejects(one('SELECT profitia_e1_authority.calendar_delivery_verify($1)',[proof]),{code:'42501'})
  await assert.rejects(f.ingest.query('SELECT profitia_e1_authority.calendar_delivery_identity($1)',[request]))
 }finally{await f.close()}
})
