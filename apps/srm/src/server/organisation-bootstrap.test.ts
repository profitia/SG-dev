import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {createPeerOperationSigner} from '@profitia/platform-contracts/peer-operation'
import {profileSchemaDigest} from '@profitia/platform-contracts/user-profile'
import {basicOrganisationCompany,createSrmOrganisationBootstrapGateway} from './organisation-bootstrap'
import {mapMgbiGeneralRecord} from './mgbi-general'
const record=()=>({id:'507f1f77bcf86cd799439011',identifiers:{pl_nip:'1234563218',pl_krs:'0000123456',pl_regon:'123456789'},
 content:{current_excerpt:{naglowekA:{numerKRS:'0000123456'},dane:{dzial1:{danePodmiotu:{nazwa:'Synthetic organisation S.A.',formaPrawna:'SPÓŁKA AKCYJNA'},siedzibaIAdres:{adres:{ulica:'Testowa',nrDomu:'1',kodPocztowy:'00-001',miejscowosc:'Warszawa',kraj:'POLSKA'}}}}}},privateFinancialData:'MUST_NOT_ESCAPE'})
test('the existing MGBI General mapper yields only the eight reusable company fields',()=>{
 const value=basicOrganisationCompany(mapMgbiGeneralRecord(record(),new Date().toISOString()),'1234563218')
 assert(value.company);assert.deepEqual(Object.keys(value.company).sort(),['address','country','entityType','krs','legalName','nip','postalCode','regon'])
 assert.equal(value.company.legalName,'Synthetic organisation S.A.');assert.equal(value.company.postalCode,'00-001')
 assert(!JSON.stringify(value).includes('MUST_NOT_ESCAPE'));assert(!JSON.stringify(value).includes('current_excerpt'))
})
test('non-companies, mismatched identifiers and incomplete basic data cannot become an organisation snapshot',()=>{
 for(const legalForm of ['JEDNOOSOBOWA DZIAŁALNOŚĆ GOSPODARCZA','FUNDACJA']){
  const raw=record();raw.content.current_excerpt.dane.dzial1.danePodmiotu.formaPrawna=legalForm
  assert.deepEqual(basicOrganisationCompany(mapMgbiGeneralRecord(raw,new Date().toISOString()),'1234563218'),{status:'UNSUPPORTED_COMPANY'})
 }
 const raw=record();raw.content.current_excerpt.dane.dzial1.siedzibaIAdres.adres.kodPocztowy=''
 assert.deepEqual(basicOrganisationCompany(mapMgbiGeneralRecord(raw,new Date().toISOString()),'1234563218'),{status:'UNAVAILABLE'})
 assert.deepEqual(basicOrganisationCompany(mapMgbiGeneralRecord(record(),new Date().toISOString()),'5220000000'),{status:'UNAVAILABLE'})
})
test('unverified peer requests never reach the current account, database or provider adapter',async()=>{
 let queries=0,sdkCalls=0
 const pool=()=>({query:async()=>{queries++;throw Error('not admitted')},connect:async()=>{queries++;throw Error('not admitted')}})
 const peer={environment:'development' as const,callerApplicationId:'identity-runtime-development',receiverApplicationId:'srm-onboarding-development',
  sourceOrigin:'https://identity.example.test',targetOrigin:'https://registry.example.test',keyId:'registration-registry-v1',key:randomBytes(32),
  routes:[{method:'POST' as const,path:'/api/organisation-onboarding/company',maximumRequestBytes:1024,requireIdempotencyKey:true}],internalOrigins:[]}
 const gateway=createSrmOrganisationBootstrapGateway({peer,pool:pool() as any,auditPool:pool() as any,
  client:{authenticateRequest:async()=>{sdkCalls++;throw Error('not admitted')},sessions:{getSession:async()=>{throw Error()}},users:{getUser:async()=>{throw Error()}}} as any,
  binding:{applicationId:'srm-onboarding-development',environment:'development',projectId:'synthetic-project',branchId:'synthetic-development',databaseName:'platform_private',role:'srm_organisation_development_runtime',schemaDigest:'a'.repeat(64)},
  profileSchemaDigest:profileSchemaDigest(),proofKey:randomBytes(32),deploymentId:'synthetic',configurationVersion:'synthetic',sourcePolicyRef:'synthetic-bootstrap-source',freshnessMs:86400000,
  mgbi:{apiKey:'synthetic-never-used-provider-key',authScheme:'raw'},source:{} as any})
 const path=peer.targetOrigin+'/api/organisation-onboarding/company'
 assert.equal((await gateway.handle(new Request(path))).status,405)
 assert.equal((await gateway.handle(new Request(path+'?organisationId=foreign',{method:'POST'}))).status,404)
 const request=()=>new Request(path,{method:'POST',headers:{authorization:'Bearer synthetic-original','content-type':'application/json','idempotency-key':'a'.repeat(64)},body:JSON.stringify({nip:'1234563218',draftVersion:'1'})})
 assert.equal((await gateway.handle(request())).status,401);assert.equal(sdkCalls,0);assert.equal(queries,0)
 const signed=await createPeerOperationSigner(peer)(request()),tampered=new Request(signed,{headers:{...Object.fromEntries(signed.headers),'x-profitia-peer-operation':'invalid'}})
 assert.equal((await gateway.handle(tampered)).status,401);assert.equal(sdkCalls,0);assert.equal(queries,0)
})

test('genuine own-account Root and signed registry receiver replay only the licensed minimum without another provider call',{timeout:60000},async t=>{
 const fs=await import('node:fs'),pg=(await import('pg')).default
 const {postgresFixture,clerkFixture}=await import('../../../../packages/platform-contracts/test/fixtures/identity-profile-postgres.mjs')
 const {createIdentityProvisioner}=await import('@profitia/platform-contracts/identity-provisioning')
 const {organisationLifecycleSchemaDigest}=await import('@profitia/platform-contracts/organisation-lifecycle')
 const {organisationOnboardingSchemaDigest}=await import('@profitia/platform-contracts/organisation-profile')
 const {organisationBootstrapSchemaDigest}=await import('@profitia/platform-contracts/organisation-bootstrap')
 const db=await postgresFixture({pg,phoneParser:()=>assert.fail('Registry replay must not read or change a phone number')});let audit:any
 t.after(async()=>{await audit?.end();await db.close()})
 for(const name of ['007-organisation-onboarding.sql','008-organisation-create.sql','009-organisation-lifecycle.sql'])await db.admin.query(fs.readFileSync(new URL('../../../../packages/platform-contracts/migrations/profile/'+name,import.meta.url),'utf8'))
 await db.admin.query("INSERT INTO profitia_access.applications VALUES('srm-onboarding-development','ACTIVE',NULL)")
 await db.admin.query("UPDATE profitia_access.runtime_bindings SET application_id='srm-onboarding-development' WHERE login_role='identity_b1_runtime'")
 db.binding.applicationId='srm-onboarding-development'
 const actor:any=clerkFixture('user_registry_own');actor.origin='https://identity.example.test';actor.issuer='https://unified-drum-7191.clerk.accounts.dev'
 const original=actor.client.users.getUser
 actor.client.users.getUser=async (id:string)=>({...await original(id),primaryEmailAddressId:'verified-primary',emailAddresses:[{id:'verified-primary',emailAddress:'synthetic-registry@example.test',verification:{status:'verified'}}]})
 await db.admin.query("UPDATE profitia_profile.runtime_policies SET issuer=$1 WHERE login_role='identity_b1_runtime'",[actor.issuer])
 const account=await createIdentityProvisioner(db.options(actor) as any).ensureAccount(actor.request('POST'))
 await db.admin.query("UPDATE profitia_profile.runtime_policies SET allow_registration=false WHERE login_role='identity_b1_runtime'")
 await db.admin.query("INSERT INTO profitia_profile.organisation_onboarding_installation VALUES(true,'1.0.0',$1)",[organisationOnboardingSchemaDigest()])
 await db.admin.query("INSERT INTO profitia_profile.organisation_bootstrap_installation VALUES(true,'1.0.0',$1)",[organisationBootstrapSchemaDigest()])
 await db.admin.query("INSERT INTO profitia_profile.organisation_lifecycle_installation VALUES(true,'1.0.0',$1)",[organisationLifecycleSchemaDigest()])
 await db.admin.query("INSERT INTO profitia_profile.organisation_lifecycle_policies(login_role,enabled,policy_id,source_ref,expires_at,membership_expires_at,operations,source_policy_ref)VALUES('identity_b1_runtime',true,gen_random_uuid(),'synthetic-registry-role',clock_timestamp()+interval '1 hour',clock_timestamp()+interval '1 hour','[\"organisation.company.lookup\"]','synthetic-bootstrap-source')")
 await db.admin.query("INSERT INTO profitia_profile.organisation_onboarding_drafts(user_id,answers)VALUES($1,$2::jsonb)",[account.userId,JSON.stringify({nip:'1234563218'})])
 for(const signature of ['organisation_lifecycle_descriptor()','organisation_lifecycle_context(bigint,text)','organisation_lifecycle_admit(text,text,text,uuid,bigint,text)','organisation_lifecycle_lookup_draft(uuid)','organisation_lifecycle_company_envelope(text,uuid)','organisation_lifecycle_company_store(text,bigint,text,uuid)'])
  await db.admin.query('GRANT EXECUTE ON FUNCTION profitia_profile.'+signature+' TO identity_b1_runtime')
 const basic=basicOrganisationCompany(mapMgbiGeneralRecord(record(),new Date().toISOString()),'1234563218');assert(basic.company)
 await db.admin.query("INSERT INTO profitia_profile.organisation_company_snapshots(nip,source_ref,version,company,source_policy_ref,retrieved_at,valid_until)VALUES('1234563218','synthetic-owned-minimum','snapshot-1',$1::jsonb,'synthetic-bootstrap-source',clock_timestamp()-interval '1 second',clock_timestamp()+interval '1 hour')",[JSON.stringify(basic.company)])
 audit=new pg.Pool({...db.config,user:db.binding.role,max:1})
 const peer={environment:'development' as const,callerApplicationId:'identity-runtime-development',receiverApplicationId:'srm-onboarding-development',
  sourceOrigin:actor.origin,targetOrigin:'https://registry.example.test',keyId:'registration-registry-v1',key:randomBytes(32),
  routes:[{method:'POST' as const,path:'/api/organisation-onboarding/company',maximumRequestBytes:1024,requireIdempotencyKey:true}],internalOrigins:[]}
 const gateway=createSrmOrganisationBootstrapGateway({peer,client:actor.client as any,binding:db.binding as any,profileSchemaDigest:profileSchemaDigest(),proofKey:db.proofKey,
  pool:db.pool,auditPool:audit,deploymentId:'synthetic-registry-receiver',configurationVersion:'synthetic-v1',sourcePolicyRef:'synthetic-bootstrap-source',freshnessMs:86400000,
  source:{} as any,mgbi:{apiKey:'synthetic-never-sent-provider-key',authScheme:'raw'}})
 const incoming=(draftVersion='1')=>createPeerOperationSigner(peer)(new Request(peer.targetOrigin+'/api/organisation-onboarding/company',{method:'POST',
  headers:{authorization:'Bearer synthetic-current-official-fixture','content-type':'application/json','idempotency-key':'b'.repeat(64)},body:JSON.stringify({nip:'1234563218',draftVersion})}))
 for(let attempt=0;attempt<2;attempt++){
  const response=await gateway.handle(await incoming());assert.equal(response.status,200)
  const body=await response.json();assert.deepEqual(Object.keys(body).sort(),['company','retrievedAt','sourcePolicyRef','sourceRef','validUntil','version'])
  assert.equal(body.company.nip,'1234563218');assert.equal(body.sourceRef,'synthetic-owned-minimum');assert.equal(body.version,'snapshot-1')
  assert(!JSON.stringify(body).includes('emailAddress'));assert(!JSON.stringify(body).includes('MUST_NOT_ESCAPE'))
  assert.equal(response.headers.get('referrer-policy'),'no-referrer')
 }
 assert.deepEqual(await(await gateway.handle(await incoming('2'))).json(),{status:'UNAVAILABLE'})
 actor.active=false;assert.notEqual((await gateway.handle(await incoming())).status,200);actor.active=true
 await db.admin.query("UPDATE profitia_profile.organisation_company_snapshots SET valid_until=clock_timestamp()-interval '1 second'")
 assert.equal((await gateway.handle(await incoming())).status,503) // No admitted Source configuration: never a raw provider fallback.
 assert.equal((await db.admin.query('SELECT count(*) FROM profitia_access.organisations')).rows[0].count,'0')
 assert.equal((await db.admin.query('SELECT count(*) FROM profitia_access.product_grants')).rows[0].count,'0')
})
