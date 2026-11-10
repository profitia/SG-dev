// SYNTHETIC_ONLY. Isolated PostgreSQL identities; no real grant or provider.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {randomUUID,generateKeyPairSync,createHash} from 'node:crypto'
import pg from '../../../apps/architecture-lab/node_modules/pg/lib/index.js'
import {firstPartyFixture} from './fixtures/first-party-source-postgres.mjs'
import {createFirstPartySourceSigner} from '../current-e1-authority/first-party.mjs'
test('ECR lease renewal keeps revocation and finite proofs, never extends another consumer, and cannot be called by a foreign login',async()=>{
 const plan=JSON.parse(readFileSync(new URL('../../../apps/economic-calendar-runtime/operations/stage04-05-owner-plan.json',import.meta.url))),enrollment=readFileSync(new URL('../../../apps/economic-calendar-runtime/operations/enroll-stage04-05.sql',import.meta.url),'utf8')
 assert.deepEqual(JSON.parse(enrollment.match(/expected jsonb:=\$plan\$([\s\S]*?)\$plan\$::jsonb/)[1]),plan)
 const f=await firstPartyFixture(),role='economic_calendar_development_ingest',app='profitia-economic-calendar-runtime-development',org='225e465b-8b89-467d-92d1-7fef61b555fe',ids=plan.identity.renewedGrantIds
 const key=generateKeyPairSync('ed25519'),publicKey=key.publicKey.export({type:'spki',format:'pem'}),bindingId=randomUUID(),serviceId=randomUUID()
 const synthetic={...plan,identity:{...plan.identity,keyId:'SYNTHETIC_ONLY',publicKeySha256:createHash('sha256').update(publicKey).digest('hex'),bindingId,serviceId,newGrant:{...plan.identity.newGrant,initialExpiry:new Date(Date.now()+86400000).toISOString()}}}
 const syntheticEnrollment=enrollment.replace(/(?<=expected jsonb:=\$plan\$)[\s\S]*?(?=\$plan\$::jsonb)/,JSON.stringify(synthetic))
 const resources=['api.eia.publication-calendar','api.commodities-sh.publication-calendar','api.eia.series-observations'];let own
 try{
  const root=f.databases[0]
  if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await root.query("CREATE ROLE economic_calendar_development_ingest LOGIN PASSWORD 'SYNTHETIC_ONLY_NOT_A_REAL_CREDENTIAL' NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION")
  const before=(await f.asOwner(0,q=>q.query('SELECT to_jsonb(g) AS value FROM profitia_services.read_grants g ORDER BY grant_id'))).rows
  await f.asOwner(0,async q=>{
   await q.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')",[org])
   await q.query("INSERT INTO profitia_access.applications(application_id,status) VALUES($1,'ACTIVE')",[app])
   await q.query("INSERT INTO profitia_access.runtime_bindings VALUES($1,$2,'ACTIVE')",[role,app])
   await q.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('spendguru',$1,'SPENDGURU',ARRAY['market'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_ONLY',clock_timestamp()+interval '60 days')",[org])
   await q.query("INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'SPENDGURU_SAAS','SYNTHETIC_ONLY','SYNTHETIC_ONLY','ACTIVE','SYNTHETIC_ONLY',clock_timestamp()+interval '1 day')",[role,bindingId,serviceId])
   for(let i=0;i<2;i++)await q.query("INSERT INTO profitia_services.read_grants(grant_id,login_role,organisation_id,operation,feature,resource_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'knowledge.read','market',$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',clock_timestamp()+interval '1 day')",[ids[i],role,org,resources[i]])
   await q.query("INSERT INTO profitia_e1_authority.source_components(component_id,key_id,application_id,login_role,receiver_application_id,source_origin,public_key,deployment_id,configuration_version,status,source_ref,expires_at) VALUES('economic-calendar-runtime-development','SYNTHETIC_ONLY',$1,$2,$3,'urn:profitia:service:synthetic-ecr',$4,'SYNTHETIC_ONLY','SYNTHETIC_ONLY','ACTIVE','SYNTHETIC_ONLY',clock_timestamp()+interval '1 day')",[app,role,f.apps[1],publicKey])
   await q.query(readFileSync(new URL('../current-e1-authority/migrations/010-ecr-service-continuity.sql',import.meta.url),'utf8'))
   await q.query(readFileSync(new URL('../current-e1-authority/migrations/011-ecr-source-continuity.sql',import.meta.url),'utf8'))
   await q.query("UPDATE profitia_access.installation SET project_id=$1,branch_id=$2,database_name=current_database()",[plan.identity.projectId,plan.identity.branchId])
  })
  const enroll=p=>f.asOwner(0,async q=>{await q.query("SELECT set_config('ecr.stage0405_plan',$1,true),set_config('ecr.stage0405_owner_ref',$2,true)",[JSON.stringify(p),'owner-decision:sha256:'+'1'.repeat(64)]);await q.query(syntheticEnrollment)})
  await assert.rejects(enroll({...synthetic,organisationId:'11111111-1111-4111-8111-111111111111'}),/EXACT_STAGE0405_OWNER_DECISION_REQUIRED/)
  await enroll(synthetic);await assert.rejects(enroll(synthetic),/ECR_STAGE0405_EXISTS_RECONCILE/)
  await f.asOwner(0,q=>q.query('UPDATE profitia_access.installation SET project_id=$1,branch_id=$2',[f.bindings[0].projectId,f.bindings[0].branchId]))
  own=new pg.Client({...root.connectionParameters,user:role,password:'SYNTHETIC_ONLY_NOT_A_REAL_CREDENTIAL'});await own.connect()
  const r=(await own.query('SELECT profitia_e1_authority.renew_ecr_service_access() AS value')).rows[0].value
  assert.equal(r.status,'RENEWED');assert.equal(r.licenceRenewed,false);assert(Number.isFinite(Date.parse(r.leaseUntil)))
  assert.equal((await own.query('SELECT profitia_e1_authority.renew_ecr_service_access() AS value')).rows[0].value.status,'CURRENT')
  const status=(await own.query('SELECT profitia_e1_authority.ecr_access_expiry_status() AS value')).rows[0].value
  assert.equal(status.dependencies.filter(x=>x.kind==='SERVICE_GRANT').length,3);assert(status.dependencies.every(x=>x.status==='ACTIVE'));assert.equal(status.dependencies.find(x=>x.id==='parent-product-market').kind,'PRODUCT_ENTITLEMENT')
  await assert.rejects(f.pools[0].query('SELECT profitia_e1_authority.ecr_access_expiry_status()'),e=>e.code==='42501')
  const after=(await f.asOwner(0,q=>q.query('SELECT to_jsonb(g) AS value FROM profitia_services.read_grants g WHERE login_role<>$1 ORDER BY grant_id',[role]))).rows;assert.deepEqual(before,after)
  const expiry=await f.asOwner(0,q=>q.query("SELECT profitia_e1_authority.ecr_receiver_deadline('economic-calendar-runtime-development','profitia-source-hub-development',clock_timestamp()-interval '1 day') AS own,profitia_e1_authority.ecr_receiver_deadline('synthetic-other','profitia-source-hub-development',clock_timestamp()-interval '1 day') AS other"))
  assert(expiry.rows[0].own>new Date());assert(expiry.rows[0].other<new Date())
  await f.asOwner(0,async q=>{await q.query("UPDATE profitia_e1_authority.receivers SET expires_at=clock_timestamp()-interval '1 second' WHERE application_id=$1",[f.apps[1]]);await q.query("UPDATE profitia_e1_authority.source_receivers SET expires_at=clock_timestamp()-interval '1 second' WHERE application_id=$1",[f.apps[1]])})
  const current=(await f.pools[0].query("SELECT profitia_e1_authority.source_consumer('economic-calendar-runtime-development','SYNTHETIC_ONLY') AS own,profitia_e1_authority.source_consumer($1,'synthetic-key') AS other",[f.components.report.id])).rows[0]
  assert(current.own);assert.equal(current.other,null);assert(Number.isFinite(Date.parse(current.own.expiresAt)))
  const execution={kind:'SERVICE',organisationId:org,grantId:ids[2]},command={contractVersion:'1.4.0',provider:'eia',family:'series-observations',operation:'observations',criteria:{path:'petroleum/stoc/wstk',frequency:'weekly',data:['value'],facets:{series:['WCESTUS1']},limit:1}}
  const signed=await createFirstPartySourceSigner({environment:'development',componentId:'economic-calendar-runtime-development',consumerApplicationId:app,receiverApplicationId:f.apps[1],sourceOrigin:'urn:profitia:service:synthetic-ecr',targetOrigin:f.targetOrigin,keyId:'SYNTHETIC_ONLY',privateKey:key.privateKey})(new Request(f.targetOrigin+'/v1/acquire',{method:'POST',headers:{'content-type':'application/json','idempotency-key':'SYNTHETIC_ONLY_CONTINUITY_PROOF'},body:JSON.stringify({context:execution,request:command})}))
  const proof=await f.host.execute({request:signed,execution,resourceId:'api.eia.series-observations'},async(context,_tx,consumer)=>({kind:context.actorKind,app:consumer.applicationId}));assert.equal(proof.kind,'SERVICE');assert.equal(proof.app,app)
  await assert.rejects(f.pools[0].query('SELECT profitia_e1_authority.renew_ecr_service_access()'),e=>e.code==='42501')
  await f.asOwner(0,q=>q.query("UPDATE profitia_services.read_grants SET status='REVOKED' WHERE grant_id=$1",[ids[0]]))
  assert.equal((await own.query('SELECT profitia_e1_authority.renew_ecr_service_access() AS value')).rows[0].value,null)
  assert((await own.query('SELECT profitia_e1_authority.ecr_access_expiry_status() AS value')).rows[0].value.dependencies.some(x=>x.kind==='SERVICE_GRANT'&&x.status==='REVOKED'))
  await f.asOwner(0,q=>q.query("UPDATE profitia_e1_authority.ecr_continuity_policy SET status='REVOKED'"))
  const revoked=await f.asOwner(0,q=>q.query("SELECT profitia_e1_authority.ecr_receiver_deadline('economic-calendar-runtime-development','profitia-source-hub-development',clock_timestamp()-interval '1 day') AS value"));assert(revoked.rows[0].value<new Date())
  const noPrivilege=await own.query("SELECT has_table_privilege(current_user,'profitia_e1_authority.ecr_continuity_policy','UPDATE') AS mutate");assert.equal(noPrivilege.rows[0].mutate,false)
 }finally{await own?.end();await f.close()}
})
