import test from 'node:test'
import assert from 'node:assert/strict'
import {createPeerOperationVerifier} from '../../../packages/platform-contracts/src/peer-operation.mjs'
import {organisationContextSchemaDigest,organisationSelectionSchemaDigest} from '../../../packages/platform-contracts/src/organisation-context.mjs'
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

const otherOrganisation='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',ownUser='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const selectionEnv=()=>({...env(),PROFITIA_ORGANISATION_SELECTION_SCHEMA_DIGEST:organisationSelectionSchemaDigest()})
const choices=()=>({userId:ownUser,expiresAt:new Date(Date.now()+25000).toISOString(),choices:[
 {organisationId,slug:'alpha',name:'Alpha'},{organisationId:otherOrganisation,slug:'beta',name:'Beta'}]})
const entry=(overrides={})=>({choices:async()=>choices(),select:async(_request,id)=>({userId:ownUser,organisationId:id,expiresAt:new Date(Date.now()+24000).toISOString()}),...overrides})
test('multiple current own memberships require a choice before any Identity operation or preference write',async()=>{
 const r=await renewOrganisationAccess(request(),{env:selectionEnv(),organisationEntry:entry({select:()=>assert.fail('No implicit selection')}),transport:()=>assert.fail('No peer call before choice')})
 const v=await r.json();assert.equal(r.status,200);assert.equal(v.status,'SELECTION_REQUIRED')
 assert.deepEqual(v.choices,[{slug:'alpha',name:'Alpha'},{slug:'beta',name:'Beta'}])
 assert.deepEqual(Object.keys(v).sort(),['choices','expiresAt','status'])
})
test('a slug is mapped to an own current member by Root before unchanged exact peer routes',async()=>{
 const config=readOrganisationAccessConfiguration(selectionEnv()),verify=createPeerOperationVerifier(config.peer),calls=[]
 const r=await renewOrganisationAccess(request('{"slug":"alpha"}'),{env:selectionEnv(),organisationEntry:entry({select:async(r,id)=>{
  assert.equal(id,organisationId);assert.equal(r.headers.get('authorization'),'Bearer synthetic.original.session')
  return {userId:ownUser,organisationId:id,expiresAt:new Date(Date.now()+22000).toISOString()}
 }}),transport:async(r)=>{
  assert(await verify(r));assert.equal(new URL(r.url).search,'')
  if(r.method==='POST')assert.equal(await r.clone().text(),'{}')
  calls.push(r.method);return Response.json(r.method==='GET'?{...snapshot(),organisation:{organisationId,slug:'alpha'}}:projection())
 }})
 const v=await r.json();assert.equal(v.status,'READY');assert.equal(v.slug,'alpha');assert.equal(v.organisationId,organisationId)
 assert(Date.parse(v.expiresAt)<=Date.now()+22000);assert.deepEqual(calls,['GET','POST'])
})
test('foreign selectors, extra authority fields and overlong input cannot reach selection or peers',async()=>{
 for(const body of ['{"slug":"foreign"}','{"slug":"alpha","organisationId":"'+otherOrganisation+'"}','{"organisationId":"'+organisationId+'"}','{"slug":"'+('x'.repeat(200))+'"}']){
  const r=await renewOrganisationAccess(request(body),{env:selectionEnv(),organisationEntry:entry({select:()=>assert.fail()}),transport:()=>assert.fail()})
  assert([400,403].includes(r.status))
 }
})
test('stale own evidence and an inconsistent selection result cannot unlock or contact Identity',async()=>{
 for(const organisationEntry of [
  entry({choices:async()=>({...choices(),expiresAt:new Date(0).toISOString()})}),
  entry({select:async()=>({userId:ownUser,organisationId:otherOrganisation,expiresAt:new Date(Date.now()+24000).toISOString()})}),
  entry({select:async()=>({userId:'foreign-user',organisationId,expiresAt:new Date(Date.now()+24000).toISOString()})}),
  entry({select:async()=>{throw Error('Membership revoked')}}),
 ]){
  const r=await renewOrganisationAccess(request('{"slug":"alpha"}'),{env:selectionEnv(),organisationEntry,transport:()=>assert.fail()})
  assert.equal(r.status,503)
 }
})
test('Identity observing a concurrent different organisation fails closed before access projection',async()=>{
 let calls=0
 const r=await renewOrganisationAccess(request('{"slug":"alpha"}'),{env:selectionEnv(),organisationEntry:entry(),transport:async()=>{
  calls++;return Response.json({...snapshot(),organisation:{organisationId:otherOrganisation,slug:'beta'}})
 }})
 assert.equal(r.status,409);assert.equal(calls,1)
})
test('only the explicitly configured current legacy membership may use the existing workspace',async()=>{
 const cfg={...selectionEnv(),PROFITIA_ORGANISATION_CONTEXT_LEGACY_ORGANISATION_ID:otherOrganisation}
 const own=()=>({...choices(),choices:[{organisationId:otherOrganisation,slug:null,name:null}]})
 const r=await renewOrganisationAccess(request('{"slug":"_legacy"}'),{env:cfg,organisationEntry:entry({choices:async()=>own()}),transport:()=>assert.fail()})
 assert.equal(r.status,200);const v=await r.json();assert.equal(v.status,'READY');assert.equal(v.slug,'_legacy');assert.equal(v.organisationId,otherOrganisation)
 const bad=await renewOrganisationAccess(request('{"slug":"_legacy"}'),{env:selectionEnv(),organisationEntry:entry({choices:async()=>own()}),transport:()=>assert.fail()})
 assert.equal(bad.status,503)
})
