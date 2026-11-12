import {createOrganisationInvitationDelivery} from '../dist/src/organisation-invitation-delivery.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomBytes,randomUUID} from 'node:crypto'
import {configuration} from './fixtures.mjs'
import {createOrganisationStore,createOrganisationRecipientLookup} from '../dist/src/organisation-store.js'
import {createOrganisationHttpSurface} from '../dist/src/organisation-http.js'
import {accountTransactions} from '../dist/src/account-provisioning.js'
import {postgresFixture,clerkFixture} from '../../../packages/platform-contracts/test/fixtures/identity-profile-postgres.mjs'
import {createIdentityProvisioner} from '../../../packages/platform-contracts/src/identity-provisioning.mjs'
import {createOrganisationOnboardingDraftBackend,organisationOnboardingSchemaDigest} from '../../../packages/platform-contracts/src/organisation-profile.mjs'
import {organisationBootstrapSchemaDigest} from '../../../packages/platform-contracts/src/organisation-bootstrap.mjs'
import {organisationLifecycleSchemaDigest,openOrganisationInvitation} from '../../../packages/platform-contracts/src/organisation-lifecycle.mjs'
import {ORGANISATION_LIFECYCLE_OPERATIONS} from '../../../packages/platform-contracts/src/operation-context.mjs'

test('recipient lookup refuses partial/unverified hits, ambiguity and truncated provider responses',async()=>{
 const user=(id,email,status='verified')=>({id,primaryEmailAddressId:'primary',emailAddresses:[{id:'primary',emailAddress:email,verification:{status}}]})
 for(const page of [{data:[user('a','xa@example.test')],totalCount:1},{data:[user('a','a@example.test','unverified')],totalCount:1}]){
  const find=createOrganisationRecipientLookup({users:{getUserList:async()=>page}});assert.equal((await find(['a@example.test'])).get('a@example.test'),null)
 }
 for(const page of [{data:[],totalCount:101},{data:[user('a','a@example.test'),user('b','a@example.test')],totalCount:2},{data:[],totalCount:1}]){
  const find=createOrganisationRecipientLookup({users:{getUserList:async()=>page}});await assert.rejects(find(['a@example.test']))
 }
 const find=createOrganisationRecipientLookup({users:{getUserList:async input=>{assert.deepEqual(input.emailAddress,['a@example.test']);return {data:[user('a','A@EXAMPLE.TEST')],totalCount:1}}}})
 assert.equal((await find(['a@example.test','A@EXAMPLE.TEST'])).get('a@example.test'),'a')
 assert.throws(()=>createOrganisationRecipientLookup({users:{}}))
})

test('native organisation store commits real scoped categories and idempotent invitations with provider fixtures',{timeout:60000},async t=>{
 const db=await postgresFixture();t.after(()=>db.close())
 for(const name of ['007-organisation-onboarding.sql','008-organisation-create.sql','009-organisation-lifecycle.sql'])await db.admin.query(fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/profile/'+name,import.meta.url),'utf8'))
 await db.admin.query("INSERT INTO profitia_profile.organisation_onboarding_installation VALUES(true,'1.0.0',$1)",[organisationOnboardingSchemaDigest()])
 await db.admin.query("INSERT INTO profitia_profile.organisation_onboarding_policies VALUES('identity_b1_runtime',true)")
 await db.admin.query("INSERT INTO profitia_profile.organisation_bootstrap_installation VALUES(true,'1.0.0',$1)",[organisationBootstrapSchemaDigest()])
 const permissions=[{operation:'organisation.procurement.write',feature:'organisation_admin'},{operation:'organisation.activation.read',feature:'organisation_admin'},{operation:'organisation.invitation.create',feature:'organisation_admin'}]
 await db.admin.query("INSERT INTO profitia_profile.organisation_bootstrap_policies(login_role,enabled,policy_id,source_ref,expires_at,membership_expires_at,initial_permissions) VALUES('identity_b1_runtime',true,$1,'test-store-bootstrap',clock_timestamp()+interval '1 hour',clock_timestamp()+interval '1 day',$2::jsonb)",[randomUUID(),JSON.stringify(permissions)])
 await db.admin.query("INSERT INTO profitia_profile.organisation_lifecycle_installation VALUES(true,'1.0.0',$1)",[organisationLifecycleSchemaDigest()])
 await db.admin.query("INSERT INTO profitia_profile.organisation_lifecycle_policies(login_role,enabled,policy_id,source_ref,expires_at,membership_expires_at,operations,member_permissions,source_policy_ref) VALUES('identity_b1_runtime',true,$1,'test-store-lifecycle',clock_timestamp()+interval '1 hour',clock_timestamp()+interval '1 day',$2::jsonb,$3::jsonb,'test-source-policy')",[randomUUID(),JSON.stringify(ORGANISATION_LIFECYCLE_OPERATIONS),JSON.stringify(permissions.filter(p=>p.operation!=='organisation.invitation.create'))])
 const functions=(await db.admin.query("SELECT p.oid::regprocedure::text AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='profitia_profile' AND(p.proname LIKE 'organisation_lifecycle_%' OR p.proname LIKE 'organisation_bootstrap_%' OR p.proname LIKE 'organisation_onboarding_%')")).rows
 for(const {signature}of functions)await db.admin.query('GRANT EXECUTE ON FUNCTION '+signature+' TO identity_b1_runtime')
 const ids=['owner','member','suspended','other','new'],actors={},userIds={}
 for(const id of ids){
  const a=clerkFixture('user_store_'+id),raw=a.client.users.getUser;a.email=id+'@example.test'
  a.client.users.getUser=async subject=>({...await raw(subject),primaryEmailAddressId:'primary',emailAddresses:[{id:'primary',emailAddress:a.email,verification:{status:'verified'}}]})
  const originalRequest=a.request.bind(a);a.request=method=>{const request=originalRequest(method);if(method==='POST')request.headers.set('content-type','application/json');return request}
  actors[id]=a;const receipt=await createIdentityProvisioner(db.options(a)).ensureAccount(a.request('POST'));userIds[id]=receipt.userId
 }
 const key=randomBytes(32),cfg=configuration({applicationId:db.binding.applicationId,targets:{sg2:{applicationId:'spendguru',origin:'https://sg2.example.test',routes:{dashboard:'/pl/dashboard'}}}})
 let acquisitions=0,packageReady=false
 const company={entityType:'COMPANY',country:'PL',nip:'1234563218',krs:'0000123456',regon:'123456789',legalName:'Synthetic native store S.A.',address:'ul. Testowa 1, Warszawa',postalCode:'00-001'}
 const companySource={ready:async()=>{},acquire:async(_request,{nip,context})=>{
  acquisitions++;assert.equal(context.mode,'BOOTSTRAP');assert.equal(context.organisationId,null);assert.equal(nip,company.nip)
  const timestamp=Date.now();return {company,sourceRef:'synthetic-registry',version:'snapshot-1',sourcePolicyRef:'test-source-policy',retrievedAt:new Date(timestamp).toISOString(),validUntil:new Date(timestamp+60000).toISOString()}
 }}
 const subjects=new Map(ids.map(id=>[actors[id].email,'user_store_'+id]))
 const common={configuration:cfg,binding:db.binding,schemaDigest:db.options(actors.owner).schemaDigest,lifecycleSchemaDigest:organisationLifecycleSchemaDigest(),
  proofKey:db.options(actors.owner).proofKey,encryptionKey:key,keyId:'test-key-1',transact:accountTransactions(db.pool),independentQuery:db.options(actors.owner).independentQuery,
  deploymentId:'test-store',configurationVersion:'test-store-1',companySource,workspaceAccess:{ready:async()=>{},resolve:async()=>({status:packageReady?'READY':'PENDING_PACKAGE'})},
  workspaceTargetId:'sg2',workspaceRouteKey:'dashboard',findRecipients:async emails=>new Map(emails.map(email=>[email,subjects.get(email)??null]))}
 const stores=Object.fromEntries(ids.map(id=>[id,createOrganisationStore({...common,client:actors[id].client})]))
 const owner=stores.owner,post=()=>actors.owner.request('POST'),get=()=>actors.owner.request('GET')
 await owner.ready()
 const draft=createOrganisationOnboardingDraftBackend(db.options(actors.owner))
 await draft.saveCurrentDraft(post(),{expectedVersion:'0',patch:{nip:company.nip}})
 await t.test('NIP lookup writes only a governed basic snapshot and restores the same company',async()=>{
  const found=await owner.lookupCompany(post(),{nip:company.nip,draftVersion:'1'});assert.equal(found.company.legalName,company.legalName);assert.equal(acquisitions,1)
  const again=await owner.lookupCompany(post(),{nip:company.nip,draftVersion:'1'});assert.deepEqual(again,found);assert.equal(acquisitions,1)
  const snapshot=await owner.snapshot(get());assert.equal(snapshot.organisation,null);assert.equal(snapshot.company.company.nip,company.nip)
 })
 const finalDraft=await draft.saveCurrentDraft(post(),{expectedVersion:'1',patch:{companySelection:{sourceRef:'synthetic-registry',version:'snapshot-1'},slug:'test-store-company',
  industry:{id:'construction'},categories:[{catalogueId:'construction.asphalt'}],teamRange:'1-5'}})
 const bootstrap=createOrganisationHttpSurface({...db.options(actors.owner),client:actors.owner.client,configuration:cfg,
  bootstrapSchemaDigest:organisationBootstrapSchemaDigest(),transact:accountTransactions(db.pool),deploymentId:'test-store',configurationVersion:'test-store-1',
  readVerifiedCompany:owner.readStoredCompany,conversation:owner})
 const created=await bootstrap.complete(post(),{commandId:randomUUID(),draftVersion:finalDraft.version});assert.equal(created.status,'CREATED')
 const oid=created.organisationId
 await t.test('organisation and personal profile persist while workspace waits for a real package',async()=>{
  const snapshot=await owner.snapshot(get());assert.equal(snapshot.organisation.organisationId,oid);assert.equal(snapshot.categoriesRequired,false);assert.equal(snapshot.procurementVersion,'1')
  assert.deepEqual(await owner.activation(get()),{status:'PENDING_PACKAGE'})
  packageReady=true;assert.deepEqual(await owner.activation(get()),{status:'READY',workspaceUrl:'https://sg2.example.test/pl/dashboard'});packageReady=false
 })
 await t.test('personal category CAS is scoped to its user and organisation',async()=>{
  assert.deepEqual(await owner.savePersonalCategories(post(),{expectedVersion:'1',categories:[{customName:'Synthetic steel'}]}),{version:'2'})
  await assert.rejects(owner.savePersonalCategories(post(),{expectedVersion:'1',categories:[{customName:'Stale'}]}),e=>e.status===409)
  assert.equal((await owner.snapshot(get())).draft.answers.categories[0].label,'Synthetic steel')
 })
 for(const id of ['member','suspended'])await db.admin.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,$3,'test-existing-member',clock_timestamp()+interval '1 day')",[oid,userIds[id],id==='suspended'?'SUSPENDED':'ACTIVE'])
 let batch,proofs
 const commandId=randomUUID(),emails=['owner@example.test','member@example.test','suspended@example.test','other@example.test','new@example.test','new@example.test','bad']
 await t.test('same-org active, suspended, self, duplicates and invalid emails enqueue no extra deliveries',async()=>{
  batch=await owner.sendInvitations(post(),{commandId,emails})
  assert.deepEqual(batch.items.map(i=>i.status),['SELF','ALREADY_MEMBER','MEMBERSHIP_REQUIRES_REVIEW','ENQUEUED','ENQUEUED','DUPLICATE','INVALID_EMAIL'])
  assert.equal((await db.admin.query('SELECT count(*) FROM profitia_profile.organisation_invitation_outbox')).rows[0].count,'2')
  const rows=(await db.admin.query('SELECT invitation_id,encrypted_payload FROM profitia_profile.organisation_invitation_outbox')).rows
  proofs=Object.fromEntries(rows.map(r=>{const payload=openOrganisationInvitation(r.encrypted_payload,{key,keyId:'test-key-1',invitationId:r.invitation_id});return[payload.recipient,payload.email.token]}))
  assert.equal(Object.keys(proofs).length,2)
 })
 await t.test('command replay and already-pending invitation cannot duplicate delivery',async()=>{
  assert.deepEqual(await owner.sendInvitations(post(),{commandId,emails}),batch)
  const pending=await owner.sendInvitations(post(),{commandId:randomUUID(),emails:['new@example.test']});assert.equal(pending.items[0].status,'ALREADY_INVITED')
  await assert.rejects(owner.sendInvitations(post(),{commandId,emails:['other@example.test']}),e=>e.status===409)
  assert.equal((await db.admin.query('SELECT count(*) FROM profitia_profile.organisation_invitation_outbox')).rows[0].count,'2')
 })

 await t.test('real durable queue makes one provider attempt per invitation and never retries UNKNOWN',async()=>{
  let calls=0
  const worker=createOrganisationInvitationDelivery({...common,query:common.independentQuery,issuer:cfg.issuer,client:actors.owner.client,identityOrigin:cfg.origin,allowedIdentityOrigins:[cfg.origin],autoStart:false,
   prepare:async email=>{assert.equal(email.organisationName,company.legalName);assert.equal(email.inviterEmail,actors.owner.email);return {subject:'Synthetic invitation',html:'<p>Synthetic invitation</p>',text:'Synthetic invitation'}},
   mailgun:{environment:'development',region:'eu',domain:'notify.example.test',apiKey:'synthetic_private_mailgun_key_12345',authorizedRecipients:[],from:'account@notify.example.test',senderName:'SpendGuru'},
   fetch:async(url,request)=>{calls++;assert.equal(url,'https://api.eu.mailgun.net/v3/notify.example.test/messages');assert.equal(request.body.get('o:tag'),'organisation-invitation-development');assert.equal(request.body.get('o:tracking'),'no');if(calls===1)throw Error('synthetic ambiguous provider response');return Response.json({id:'<synthetic-success@notify.example.test>'})}})
  try{
   await worker.ready();await Promise.all([worker.tick(),worker.tick()]);assert.equal(calls,1)
   await worker.tick();assert.equal(calls,2);await worker.tick();assert.equal(calls,2)
   const rows=(await db.admin.query('SELECT status,encrypted_payload FROM profitia_profile.organisation_invitation_outbox ORDER BY status')).rows
   assert.deepEqual(rows.map(r=>r.status),['ACCEPTED','UNKNOWN']);for(const row of rows)assert.deepEqual(row.encrypted_payload,{})
  }finally{await worker.stop()}
 })
 await t.test('GET and a different verified account cannot consume an invitation',async()=>{
  await assert.rejects(owner.acceptInvitation(get(),{commandId:randomUUID(),proof:proofs['new@example.test']}))
  assert.deepEqual(await owner.acceptInvitation(post(),{commandId:randomUUID(),proof:proofs['new@example.test']}),{status:'INVITATION_UNAVAILABLE'})
  assert.equal((await db.admin.query("SELECT count(*) FROM profitia_profile.organisation_invitations WHERE status='PENDING'")).rows[0].count,'2')
 })
 await t.test('verified acceptance creates one membership and requires only personal categories',async()=>{
  const a=actors.new,store=stores.new,input={commandId:randomUUID(),proof:proofs['new@example.test']}
  assert.deepEqual(await store.acceptInvitation(a.request('POST'),input),{status:'ACCEPTED'})
  assert.deepEqual(await store.acceptInvitation(a.request('POST'),input),{status:'ACCEPTED'})
  const snapshot=await store.snapshot(a.request('GET'));assert.equal(snapshot.organisation.organisationId,oid);assert.equal(snapshot.categoriesRequired,true);assert.equal(snapshot.procurementVersion,'0')
  assert.equal((await db.admin.query('SELECT count(*) FROM profitia_access.memberships WHERE organisation_id=$1 AND user_id=$2',[oid,userIds.new])).rows[0].count,'1')
  assert.equal((await db.admin.query('SELECT count(*) FROM profitia_access.product_grants')).rows[0].count,'0')
  const results=await Promise.allSettled([store.savePersonalCategories(a.request('POST'),{expectedVersion:'0',categories:[{customName:'Personal A'}]}),store.savePersonalCategories(a.request('POST'),{expectedVersion:'0',categories:[{customName:'Personal B'}]})])
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.status===409).length,1)
  assert.equal((await owner.snapshot(get())).draft.answers.categories[0].label,'Synthetic steel')
 })
 await t.test('inviter revocation prevents acceptance without granting or restoring a membership',async()=>{
  await db.admin.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[oid,userIds.owner])
  const result=await stores.other.acceptInvitation(actors.other.request('POST'),{commandId:randomUUID(),proof:proofs['other@example.test']});assert.equal(result.status,'INVITATION_UNAVAILABLE')
  assert.equal((await db.admin.query('SELECT count(*) FROM profitia_access.memberships WHERE organisation_id=$1 AND user_id=$2',[oid,userIds.other])).rows[0].count,'0')
 })
})
