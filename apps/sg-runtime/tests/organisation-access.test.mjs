import test from 'node:test'
import assert from 'node:assert/strict'
import {createPeerOperationVerifier} from '../../../packages/platform-contracts/src/peer-operation.mjs'
import {organisationContextSchemaDigest} from '../../../packages/platform-contracts/src/organisation-context.mjs'
import {renewOrganisationAccess,readOrganisationAccessConfiguration} from '../lib/platform/organisation-access.ts'
const issuer='https://self-service-fixture.clerk.accounts.dev',publicOrigin='https://sg2.example.test',organisationId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const env=()=>({PROFITIA_AUTH_PROVIDER:'clerk',TARGET_ENVIRONMENT:'development',PROFITIA_SELF_SERVICE_ENABLED:'true',PROFITIA_SELF_SERVICE_PUBLIC_ORIGIN:publicOrigin,
 PROFITIA_SELF_SERVICE_SATELLITE_ENABLED:'true',PROFITIA_IDENTITY_RUNTIME_ORIGIN:'https://identity.example.test',PROFITIA_CLERK_ISSUER:issuer,
 PROFITIA_CLERK_PUBLISHABLE_KEY:'pk_test_'+Buffer.from(new URL(issuer).host+'$').toString('base64url'),PROFITIA_CLERK_SECRET_KEY:'sk_test_fixture',
 PROFITIA_CLERK_AUTHORIZED_PARTIES:JSON.stringify([publicOrigin]),PROFITIA_ORGANISATION_CONTEXT_ENABLED:'true',PROFITIA_ORGANISATION_CONTEXT_SCHEMA_DIGEST:organisationContextSchemaDigest(),PROFITIA_ORGANISATION_ACCESS_ENABLED:'true',PROFITIA_ORGANISATION_ACCESS_PEER_KEY:'a'.repeat(64),PROFITIA_ORGANISATION_ACCESS_KEY_ID:'sg2-identity-organisation-v1'})
const request=(body='{}',headers={},suffix='')=>new Request(publicOrigin+'/api/account/organisation-access'+suffix,{method:'POST',headers:{origin:publicOrigin,'content-type':'application/json',authorization:'Bearer synthetic.original.session',...headers},body})
const snapshot=()=>({organisation:{organisationId,slug:'synthetic'},categoriesRequired:false,accessProjectionRequired:true})
const projection=()=>({organisationId,status:'SYNCHRONISED',expiresAt:new Date(Date.now()+25000).toISOString()})
test('disabled and malformed configuration cannot make a peer request',async()=>{
 assert.equal(readOrganisationAccessConfiguration({}),null)
 assert.equal((await renewOrganisationAccess(request(),{env:{},transport:()=>assert.fail()})).status,503)
 for(const patch of [{PROFITIA_ORGANISATION_ACCESS_ENABLED:'yes'},{PROFITIA_ORGANISATION_ACCESS_PEER_KEY:''},{TARGET_ENVIRONMENT:'production'}])assert.throws(()=>readOrganisationAccessConfiguration({...env(),...patch}))
})
test('empty own command forwards only the original bearer and two exact signed operations',async()=>{
 const config=readOrganisationAccessConfiguration(env()),verify=createPeerOperationVerifier(config.peer),calls=[]
 const response=await renewOrganisationAccess(request('{}',{cookie:'must-not-leave','x-user-id':'forged','x-organisation-id':'forged','x-role':'admin'}),{env:env(),transport:async(input,options)=>{
  assert(input instanceof Request);assert(await verify(input));assert.equal(input.headers.get('authorization'),'Bearer synthetic.original.session')
  for(const h of ['cookie','x-user-id','x-organisation-id','x-role'])assert.equal(input.headers.get(h),null)
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store')
  calls.push([input.method,new URL(input.url).pathname]);return Response.json(input.method==='GET'?snapshot():projection())
 }})
 assert.equal(response.status,200);assert.equal((await response.json()).status,'READY')
 assert.deepEqual(calls,[['GET','/v1/account/organisation-onboarding/snapshot'],['POST','/v1/account/organisation-onboarding/access']])
 assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('access-control-allow-origin'),null)
})
test('browser selectors, foreign origin, query and missing bearer are rejected before transport',async()=>{
 for(const r of [request('{"organisationId":"forged"}'),request('{}',{origin:'https://foreign.example.test'}),request('{}',{},'?organisationId=forged'),request('{}',{authorization:''}),request('{}',{'sec-fetch-site':'same-site'})]){
  assert([400,401,403].includes((await renewOrganisationAccess(r,{env:env(),transport:()=>assert.fail()})).status))
 }
})
test('incomplete own profile returns to central conversation without an access write',async()=>{
 for(const value of [{...snapshot(),organisation:null},{...snapshot(),categoriesRequired:true}]){
  let calls=0;const r=await renewOrganisationAccess(request(),{env:env(),transport:async()=>{calls++;return Response.json(value)}})
  assert.deepEqual(await r.json(),{status:'ONBOARDING_REQUIRED'});assert.equal(calls,1)
 }
})
test('wrong organisation, stale or overlong projection never unlock the workspace',async()=>{
 for(const patch of [{organisationId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},{expiresAt:new Date(0).toISOString()},{expiresAt:new Date(Date.now()+60000).toISOString()},{status:'READY'}]){
  let calls=0;const r=await renewOrganisationAccess(request(),{env:env(),transport:async()=>Response.json(++calls===1?snapshot():{...projection(),...patch})})
  assert([409,503].includes(r.status))
 }
 for(const status of [401,403,409,503])assert.equal((await renewOrganisationAccess(request(),{env:env(),transport:async()=>Response.json({},{status})})).status,status)
})
test('pending or reconciliation remains a partial success and never fabricates a lease',async()=>{
 for(const status of ['PENDING_PACKAGE','RECONCILIATION_REQUIRED']){
  let calls=0;const r=await renewOrganisationAccess(request(),{env:env(),transport:async()=>Response.json(++calls===1?snapshot():{status,organisationId})})
  assert.deepEqual(await r.json(),{status})
 }
})
test('oversized, malformed or aborted responses cannot be used',async()=>{
 for(const transport of [async()=>new Response('x'.repeat(25000)),async()=>new Response('{'),async()=>{throw Error('fixture outage')}])assert.equal((await renewOrganisationAccess(request(),{env:env(),transport})).status,503)
 const c=new AbortController();c.abort();const r=new Request(request(),{signal:c.signal})
 assert([403,503].includes((await renewOrganisationAccess(r,{env:env(),transport:()=>assert.fail()})).status))
})

test('explicit legacy members preserve the original account shell without creating a package or accessing another tenant',async()=>{
 const legacyEnv={...env(),PROFITIA_ORGANISATION_CONTEXT_LEGACY_ORGANISATION_ID:organisationId}
 for(const [selected,expected]of [[organisationId,'READY'],['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ONBOARDING_REQUIRED'],[null,'ONBOARDING_REQUIRED']]){
  let writes=0,reads=0
  const response=await renewOrganisationAccess(request(),{env:legacyEnv,resolveCurrentOrganisation:async()=>{reads++;return {organisationId:selected,expiresAt:new Date(Date.now()+5000).toISOString()}},
   transport:async(input)=>{if(input.method==='POST')writes++;return Response.json({...snapshot(),organisation:null})}})
  assert.equal((await response.json()).status,expected);assert.equal(reads,1);assert.equal(writes,0)
 }
 const response=await renewOrganisationAccess(request(),{env:legacyEnv,resolveCurrentOrganisation:async()=>({organisationId,expiresAt:new Date(0).toISOString()}),transport:async()=>Response.json({...snapshot(),organisation:null})})
 assert.equal((await response.json()).status,'ONBOARDING_REQUIRED')
})
