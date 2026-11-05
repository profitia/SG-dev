import test from 'node:test';
import assert from 'node:assert/strict';
import {createPeerOperationSigner,peerOperationAttribution,peerOperationIdentityRequest} from '@profitia/platform-contracts/peer-operation';
import {readConfiguration} from '../src/config.mjs';
import {createHubPeerVerifier,peerConfiguration} from '../src/server.mjs';
const base={environment:'development',applicationId:'profitia-source-hub-development',publicOrigin:'https://hub.synthetic.test',callerOrigin:'https://newsfeed.synthetic.test',callerApplicationId:'profitia-newsfeed-api-development',peerKeyId:'legacy-key',secrets:{peerKey:Buffer.alloc(32,1),additionalPeerKey:Buffer.alloc(32,2)}};
const extra={applicationId:'procurement-insights-oil-v04',sourceOrigin:'https://newsfeed.synthetic.test',keyId:'oil-v04-key',expiresAt:new Date(Date.now()+60000).toISOString()};
async function signed(config,id='synthetic-request-001'){
 const sign=createPeerOperationSigner(config);
 return sign(new Request(config.targetOrigin+'/v1/acquire',{method:'POST',headers:{authorization:'Bearer SYNTHETIC_ONLY','content-type':'application/json','idempotency-key':id},body:'{}'}));
}
test('existing Newsfeed proof remains valid with a separately bound second consumer',async()=>{
 const c={...base,additionalPeer:extra},verify=createHubPeerVerifier(c),request=await signed(peerConfiguration(c));
 assert.equal(await verify(request),true);assert.equal(peerOperationAttribution(request).callerApplicationId,base.callerApplicationId);
});
test('new consumer attribution retains original bearer, not an invented user or Newsfeed identity',async()=>{
 const c={...base,additionalPeer:extra},verify=createHubPeerVerifier(c);
 const cfg={...peerConfiguration(c),callerApplicationId:extra.applicationId,sourceOrigin:extra.sourceOrigin,keyId:extra.keyId,key:c.secrets.additionalPeerKey};
 const request=await signed(cfg);assert.equal(await verify(request),true);
 assert.equal(peerOperationAttribution(request).callerApplicationId,extra.applicationId);
 assert.equal(peerOperationIdentityRequest(request).headers.get('authorization'),'Bearer SYNTHETIC_ONLY');
 // Transport authentication is repeatable during its short expiry. The
 // existing licensed acquisition/idempotency transaction prevents re-sends.
 assert.equal(await verify(request),true);
});
test('caller spoofing, key substitution, expired peer and unsigned requests fail closed',async()=>{
 for(const patch of [{callerApplicationId:base.callerApplicationId},{key:Buffer.alloc(32,9)},{sourceOrigin:'https://foreign.synthetic.test'}]){
  const c={...base,additionalPeer:extra},cfg={...peerConfiguration(c),callerApplicationId:extra.applicationId,sourceOrigin:extra.sourceOrigin,keyId:extra.keyId,key:c.secrets.additionalPeerKey,...patch};
  assert.equal(await createHubPeerVerifier(c)(await signed(cfg)),false);
 }
 const c={...base,additionalPeer:{...extra,expiresAt:new Date(Date.now()-1000).toISOString()}};
 const cfg={...peerConfiguration(c),callerApplicationId:extra.applicationId,sourceOrigin:extra.sourceOrigin,keyId:extra.keyId,key:c.secrets.additionalPeerKey};
 assert.equal(await createHubPeerVerifier(c)(await signed(cfg)),false);
 assert.equal(await createHubPeerVerifier(base)(new Request(base.publicOrigin+'/v1/acquire',{method:'POST',body:'{}'})),false);
});
const env={SOURCE_HUB_ENVIRONMENT:'development',SOURCE_HUB_DATABASE_URL:'postgresql://source_hub_development_runtime:SYNTHETIC@ep-noisy-darkness-barhqoqw-pooler.c-8.eu-central-1.aws.neon.tech/neondb?sslmode=require',SOURCE_HUB_SOURCE_DATABASE_URL:'postgresql://source_hub_development_source_runtime:SYNTHETIC@ep-noisy-darkness-barhqoqw-pooler.c-8.eu-central-1.aws.neon.tech/neondb?sslmode=require',SOURCE_HUB_PUBLIC_ORIGIN:base.publicOrigin,NEWSFEED_PUBLIC_ORIGIN:base.callerOrigin,PROFITIA_IDENTITY_ISSUER:'https://identity.synthetic.test',CLERK_SECRET_KEY:'sk_test_SYNTHETIC_ONLY',CLERK_PUBLISHABLE_KEY:'pk_test_SYNTHETIC_ONLY',SOURCE_HUB_PEER_KEY_B64:Buffer.alloc(32,1).toString('base64'),SOURCE_HUB_PEER_KEY_ID:base.peerKeyId,PROFITIA_AUTHORIZED_PARTIES:base.callerOrigin,PROFITIA_REQUIRED_PRODUCT:'SPENDGURU',SOURCE_HUB_DEPLOYMENT_ID:'synthetic',SOURCE_HUB_CONFIGURATION_VERSION:'synthetic'};
test('optional configuration is absent by default, all-or-nothing, bounded and non-secret when serialized',()=>{
 assert.equal('additionalPeer' in readConfiguration(env),false);
 const vars={SOURCE_HUB_ADDITIONAL_PEER_APPLICATION_ID:extra.applicationId,SOURCE_HUB_ADDITIONAL_PEER_ORIGIN:extra.sourceOrigin,SOURCE_HUB_ADDITIONAL_PEER_KEY_ID:extra.keyId,SOURCE_HUB_ADDITIONAL_PEER_KEY_B64:Buffer.alloc(32,2).toString('base64'),SOURCE_HUB_ADDITIONAL_PEER_EXPIRES_AT:extra.expiresAt};
 const c=readConfiguration({...env,...vars});assert.equal(c.additionalPeer.applicationId,extra.applicationId);assert(!JSON.stringify(c).includes(vars.SOURCE_HUB_ADDITIONAL_PEER_KEY_B64));
 for(const k of Object.keys(vars)){const v={...vars};delete v[k];assert.throws(()=>readConfiguration({...env,...v}));}
 for(const patch of [{SOURCE_HUB_ADDITIONAL_PEER_APPLICATION_ID:base.callerApplicationId},{SOURCE_HUB_ADDITIONAL_PEER_ORIGIN:base.publicOrigin},{SOURCE_HUB_ADDITIONAL_PEER_KEY_ID:base.peerKeyId},{SOURCE_HUB_ADDITIONAL_PEER_EXPIRES_AT:new Date(Date.now()+90000000).toISOString()}])assert.throws(()=>readConfiguration({...env,...vars,...patch}));
});

// Full current E1, licence, Source and RLS proof uses only an explicit loopback
// cluster. Never infer LIVE provider readiness from this synthetic integration.
test('SYNTHETIC_ONLY: separately licensed peer still requires current human E1 and matching org/user', {skip:!process.env.SOURCE_HUB_TEST_ADMIN_URL}, async t=>{
 const {fixture,command,U,V,A,B}=await import('./fixtures.mjs');
 const {createApplication}=await import('../src/server.mjs');
 const f=await fixture();t.after(()=>f.close());
 const configuration={...f.hub,secrets:{...f.hub.secrets,additionalPeerKey:Buffer.alloc(32,2)},additionalPeer:extra};
 const app=createApplication({configuration,repository:f.hubRepository,authorizer:f.hubAuthorizer,admission:f.admission,telemetry:{requestId:()=>crypto.randomUUID(),emit:e=>f.logs.push(e)}});
 const sign=createPeerOperationSigner({...peerConfiguration(configuration),callerApplicationId:extra.applicationId,sourceOrigin:extra.sourceOrigin,keyId:extra.keyId,key:configuration.secrets.additionalPeerKey});
 let seq=0;
 const acquire=async(user=U,org=A,bearer='SYNTHETIC_A')=>app.handle(await sign(new Request(configuration.publicOrigin+'/v1/acquire',{method:'POST',headers:{authorization:'Bearer '+bearer,'content-type':'application/json','idempotency-key':'synthetic-new-consumer-'+(++seq)},body:JSON.stringify({context:{organisationId:org,expectedUserId:user},request:command})})));
 const denied=await acquire();assert.equal(denied.status,403);assert.equal(f.state.providerCalls.length,0);
 await f.admin(0,'source_hub_development_owner',q=>q.query("UPDATE source_hub.provider_licences SET consumer_application_ids=array_append(consumer_application_ids,'procurement-insights-oil-v04'),retention_seconds=0"));
 const allowed=await acquire();assert.equal(allowed.status,200,await allowed.text());assert.equal(f.state.providerCalls.length,1);
 for(const args of [[V,A],[U,'33333333-3333-4333-8333-333333333333'],[U,A,'SYNTHETIC_REVOKED']]){const r=await acquire(...args);assert(r.status>=400);assert.equal(f.state.providerCalls.length,1);}
 await f.admin(0,'source_hub_development_owner',q=>q.query("UPDATE source_hub.provider_licences SET consumer_application_ids=array_remove(consumer_application_ids,'procurement-insights-oil-v04')"));
 assert.equal((await acquire()).status,403);assert.equal(f.state.providerCalls.length,1);
});
