// SYNTHETIC_ONLY: no provider, real credential or product database access.
import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync} from 'node:crypto'
import {createFirstPartySourceSigner,readFirstPartySourceClaim,verifyFirstPartySourceClaim,FIRST_PARTY_SOURCE_HEADER} from '../current-e1-authority/first-party.mjs'
import {firstPartyFixture,U,A,B} from './fixtures/first-party-source-postgres.mjs'
const key=generateKeyPairSync('ed25519'),other=generateKeyPairSync('ed25519')
const c={environment:'development',componentId:'synthetic-report-component',consumerApplicationId:'synthetic-spendguru',receiverApplicationId:'synthetic-hub',sourceOrigin:'urn:profitia:service:synthetic-reports:development',targetOrigin:'https://synthetic-hub.test',keyId:'synthetic-key',privateKey:key.privateKey}
const request=(extra={})=>new Request(c.targetOrigin+'/v1/acquire',{method:'POST',headers:{'content-type':'application/json','idempotency-key':'synthetic-intent-0001',...extra},body:JSON.stringify({context:{kind:'SERVICE',organisationId:'11111111-1111-4111-8111-111111111111',grantId:'22222222-2222-4222-8222-222222222222'},request:{provider:'newsapi',family:'news-discovery',synthetic:true}})})
const options={receiverApplicationId:c.receiverApplicationId,targetOrigin:c.targetOrigin}
const registered={status:'ACTIVE',componentId:c.componentId,consumerApplicationId:c.consumerApplicationId,receiverApplicationId:c.receiverApplicationId,sourceOrigin:c.sourceOrigin,targetOrigin:c.targetOrigin,keyId:c.keyId,publicKey:key.publicKey.export({type:'spki',format:'pem'}),expiresAt:new Date(Date.now()+3600000).toISOString()}
test('independent component signature is valid without any human session; no shared component secret',async()=>{
 const signed=await createFirstPartySourceSigner(c)(request()),claim=await readFirstPartySourceClaim(signed,options)
 assert(verifyFirstPartySourceClaim(claim,registered,options));assert(!signed.headers.has('authorization'));assert.equal(claim.payload.componentId,c.componentId)
 assert(!verifyFirstPartySourceClaim(claim,{...registered,publicKey:other.publicKey.export({type:'spki',format:'pem'})},options))
})
test('new components need registry identity, not a code allowlist',async()=>{
 for(const componentId of ['synthetic-new-calendar','synthetic-future-component']){
  const signer=createFirstPartySourceSigner({...c,componentId}),claim=await readFirstPartySourceClaim(await signer(request()),options)
  assert(verifyFirstPartySourceClaim(claim,{...registered,componentId},options));assert(!verifyFirstPartySourceClaim(claim,registered,options))
 }
})
test('tampered body, organisation, idempotency and session credential invalidate the signed HTTP binding',async()=>{
 const signed=await createFirstPartySourceSigner(c)(request({authorization:'Bearer SYNTHETIC_ONLY_SESSION_A'}))
 for(const mutation of ['body','organisation','idempotency','credential']){
  const headers=new Headers(signed.headers);let body=await signed.clone().text()
  if(mutation==='body')body+=' '
  if(mutation==='organisation')body=body.replace('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333')
  if(mutation==='idempotency')headers.set('idempotency-key','synthetic-different-intent')
  if(mutation==='credential')headers.set('authorization','Bearer SYNTHETIC_ONLY_SESSION_B')
  await assert.rejects(readFirstPartySourceClaim(new Request(signed.url,{method:'POST',headers,body}),options))
 }
})
test('revoked, expired and rotated registry keys fail closed',async()=>{
 const claim=await readFirstPartySourceClaim(await createFirstPartySourceSigner(c)(request()),options)
 for(const change of [{status:'REVOKED'},{expiresAt:'2000-01-01T00:00:00.000Z'},{keyId:'different-key'},{consumerApplicationId:'different-app'},{targetOrigin:'https://other.test'}])assert(!verifyFirstPartySourceClaim(claim,{...registered,...change},options))
})
test('cookie, browser Origin, legacy signature mixing, path/host substitution and cross-environment configuration fail closed',async()=>{
 const sign=createFirstPartySourceSigner(c),signed=await sign(request())
 for(const [name,value]of [['cookie','synthetic=x'],['origin','https://untrusted.test'],['x-profitia-peer-operation','synthetic']]){
  const headers=new Headers(signed.headers);headers.set(name,value);await assert.rejects(readFirstPartySourceClaim(new Request(signed.clone(),{headers}),options))
 }
 for(const url of [c.targetOrigin+'/other','https://other.test/v1/acquire',c.targetOrigin+'/v1/acquire?q=1'])await assert.rejects(readFirstPartySourceClaim(new Request(url,{method:'POST',headers:signed.headers,body:await signed.clone().text()}),options))
 assert.throws(()=>createFirstPartySourceSigner({...c,environment:'production'}));assert.throws(()=>createFirstPartySourceSigner({...c,targetOrigin:'https://*.test'}))
})
test('wire proof expiry and unknown fields cannot become lasting ALLOW',async()=>{
 const now=Date.now(),signed=await createFirstPartySourceSigner(c,{now:()=>now})(request())
 await assert.rejects(readFirstPartySourceClaim(signed,{...options,now:()=>now+60001}))
 const h=signed.headers.get(FIRST_PARTY_SOURCE_HEADER),[p,s]=h.split('.'),payload=JSON.parse(Buffer.from(p,'base64url'));payload.allow=true
 const headers=new Headers(signed.headers);headers.set(FIRST_PARTY_SOURCE_HEADER,Buffer.from(JSON.stringify(payload)).toString('base64url')+'.'+s)
 await assert.rejects(readFirstPartySourceClaim(new Request(signed,{headers}),options))
})
test('current canonical E1 authorizes two independent components and a genuine SERVICE grant without a human session',async t=>{
 const f=await firstPartyFixture();t.after(()=>f.close());assert.equal(await f.host.ready(),true)
 const human=await f.host.execute(await f.makeSigned({component:'newsfeed',kind:'HUMAN'}),(context,tx,consumer)=>({kind:context.actorKind,id:context.actorId,user:context.subjectUserId,consumer:consumer.componentId}))
 assert.equal(human.kind,'HUMAN');assert.equal(human.user,U);assert.equal(human.consumer,f.components.newsfeed.id)
 f.clerkState.calls.length=0
 const service=await f.host.execute(await f.makeSigned(),(context,tx,consumer)=>({kind:context.actorKind,id:context.actorId,user:context.subjectUserId,consumer:consumer.componentId}))
 assert.equal(service.kind,'SERVICE');assert.equal(service.id,f.serviceId);assert.equal(service.user,null);assert.equal(service.consumer,f.components.report.id);assert.equal(f.clerkState.calls.length,0)
})

test('current E1 denies revoked membership, product, component, service grant, session and explicit DENY; revocation at outcome rolls back',async t=>{
 const f=await firstPartyFixture();t.after(()=>f.close());
 const human=()=>f.makeSigned({component:'newsfeed',kind:'HUMAN'}),service=()=>f.makeSigned();
 const run=async make=>f.host.execute(await make(),c=>c.actorId);
 const denied=async make=>assert.rejects(()=>run(make),e=>e.name==='OperationDenied');
 await t.test('ungranted real fixture human and wrong service organisation',async()=>{await denied(()=>f.makeSigned({component:'newsfeed',kind:'HUMAN',token:'SYNTHETIC_B'}));await denied(()=>f.makeSigned({organisationId:B}));});
 for(const [label,sql,restore,make]of[
  ['membership',"UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id='"+A+"'", "UPDATE profitia_access.memberships SET status='ACTIVE'",human],
  ['product',"UPDATE profitia_access.product_grants SET status='REVOKED' WHERE application_id='spendguru'", "UPDATE profitia_access.product_grants SET status='ACTIVE'",human],
  ['component',"UPDATE profitia_e1_authority.source_components SET status='REVOKED'", "UPDATE profitia_e1_authority.source_components SET status='ACTIVE'",service],
  ['service grant',"UPDATE profitia_services.read_grants SET status='REVOKED'", "UPDATE profitia_services.read_grants SET status='ACTIVE'",service],
  ['consumer application',"UPDATE profitia_access.applications SET status='DISABLED' WHERE application_id='synthetic-procurement-insights'", "UPDATE profitia_access.applications SET status='ACTIVE' WHERE application_id='synthetic-procurement-insights'",service]
 ])await t.test(label,async()=>{await f.asOwner(0,c=>c.query(sql));await denied(make);await f.asOwner(0,c=>c.query(restore));assert.ok(await run(make));});
 await t.test('Clerk revocation and unavailable authority do not retain ALLOW',async()=>{f.clerkState.sessionActive=false;await denied(human);f.clerkState.sessionActive=true;f.sourceTransportState.offline=true;await denied(service);f.sourceTransportState.offline=false;});
 await t.test('explicit service DENY overrides ALLOW',async()=>{await f.asOwner(0,c=>c.query("UPDATE profitia_services.read_grants SET effect='DENY'"));await denied(service);await f.asOwner(0,c=>c.query("UPDATE profitia_services.read_grants SET effect='ALLOW'"));});
 await t.test('signed execution/resource cannot be substituted in raw receiver SQL or at the central authority',async()=>{
  const signed=await human(),claim=await readFirstPartySourceClaim(signed.request,{receiverApplicationId:f.apps[1],targetOrigin:f.targetOrigin});
  await assert.rejects(()=>f.db(1).transact(({query})=>query('SELECT profitia_e1_receiver.source_challenge($1,$2::jsonb,$3::jsonb,$4,$5)', ['a'.repeat(64),JSON.stringify(claim.payload),JSON.stringify({...signed.execution,organisationId:B}),signed.resourceId,'a'.repeat(64)])),{code:'42501'});
  const captured=f.sourceTransportState.proof,challenge={...JSON.parse(captured.payload).request,organisationId:B,kind:'HUMAN',grantId:null,componentId:claim.payload.componentId,keyId:claim.payload.keyId,consumerRequestId:claim.payload.requestId,requestDigest:claim.payload.bodyDigest,consumerProofDigest:(await import('node:crypto')).createHash('sha256').update(claim.raw+'.'+claim.signature).digest('hex')};
  await assert.rejects(()=>f.authority.authorizeSource(new Request(f.authorityOrigin+'/v1/e1/source/authorize',{method:'POST',headers:{authorization:'Bearer SYNTHETIC_A'}}),{consumerProof:{payload:claim.raw,signature:claim.signature},challenge,previous:null}),e=>e.name==='OperationDenied');
 });
 await t.test('outcome sees a revoked grant and rolls back local mutation',async()=>{
  await f.databases[1].query('CREATE TABLE public.synthetic_rollback(id int)');await f.databases[1].query('GRANT INSERT ON public.synthetic_rollback TO source_hub_development_runtime');
  await assert.rejects(async()=>f.host.execute(await service(),async(c,tx)=>{await tx.query('INSERT INTO public.synthetic_rollback VALUES(1)');await f.asOwner(0,q=>q.query("UPDATE profitia_services.read_grants SET status='REVOKED'"));return 'WITHHELD';}),e=>e.name==='OperationDenied');
  assert.equal((await f.databases[1].query('SELECT * FROM public.synthetic_rollback')).rowCount,0);
 });
 await t.test('ordinary runtime cannot forge a proof, cross transaction or self-allow through a GUC',async()=>{
  await f.db(1).transact(async({query})=>{await query("SELECT set_config('profitia.source_proof',$1,true)",[JSON.stringify({payload:'{}',signature:'0'.repeat(64)})]);const r=await query('SELECT profitia_e1_receiver.source_scope($1,$2,$3,$4,$5,$6) AS allowed',[f.apps[1],A,'SERVICE',f.serviceId,f.components.report.id,'api.newsapi.news-discovery']);assert.equal(r.rows[0].allowed,false);});
  await assert.rejects(()=>f.pools[1].query('SELECT proof_key FROM profitia_e1_receiver.installation'),{code:'42501'});
 });
});
