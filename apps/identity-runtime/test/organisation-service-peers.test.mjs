import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createOrganisationServiceConnections} from '../dist/src/organisation-store.js'
import {organisationAccessProjectionSchemaDigest} from '../../../packages/platform-contracts/src/organisation-lifecycle.mjs'
import {createPeerOperationVerifier} from '../../../packages/platform-contracts/src/peer-operation.mjs'
test('dedicated entitlement peer preserves original bearer and rejects every wrong/stale scope',async()=>{
 const sourceOrigin='https://identity.example.test',key=randomBytes(32),userId=randomUUID(),organisationId=randomUUID()
 const registryPeer={environment:'development',callerApplicationId:'identity-runtime-development',receiverApplicationId:'srm-onboarding-development',
  sourceOrigin,targetOrigin:'https://registry.example.test',keyId:'registry-v1',key:randomBytes(32),
  routes:[{method:'POST',path:'/api/organisation-onboarding/company',maximumRequestBytes:1024,requireIdempotencyKey:true}],internalOrigins:[]}
 const workspacePeer={...registryPeer,receiverApplicationId:'package-limits-development',targetOrigin:'https://limits.example.test',keyId:'limits-v1',key,
  routes:[{method:'GET',path:'/v1/organisation-access',maximumRequestBytes:0,requireIdempotencyKey:false},{method:'GET',path:'/v1/organisation-entitlements',maximumRequestBytes:0,requireIdempotencyKey:false}]}
 const verify=createPeerOperationVerifier(workspacePeer)
 const snapshot=()=>({status:'ACTIVE',userId,organisationId,applicationId:'spendguru',assignmentRef:'package-assignment:'+randomUUID()+':1',capabilities:['BENCHMARK'],expiresAt:new Date(Date.now()+4500).toISOString(),assignmentUntil:new Date(Date.now()+60000).toISOString()})
 let value=snapshot(),calls=0
 const configuration={registryPeer,workspacePeer,sourcePolicyRef:'registry-purpose',intentKey:randomBytes(32),accessProjectionSchemaDigest:organisationAccessProjectionSchemaDigest()}
 const ports=createOrganisationServiceConnections({...configuration,transport:async incoming=>{
  calls++;assert(incoming instanceof Request);assert.equal(incoming.url,workspacePeer.targetOrigin+'/v1/organisation-entitlements')
  assert.equal(incoming.method,'GET');assert.equal(incoming.headers.get('authorization'),'Bearer synthetic-current-bearer')
  assert.equal(incoming.headers.get('cookie'),null);assert.equal(incoming.headers.get('origin'),null);assert.equal(await verify(incoming),true)
  return new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}})
 }})
 const request=()=>new Request(sourceOrigin+'/v1/account/organisation-onboarding/access',{method:'POST',headers:{authorization:'Bearer synthetic-current-bearer',cookie:'synthetic-not-forwarded','content-type':'application/json'},body:'{}'})
 const input={userId,organisationId,applicationId:'spendguru'}
 assert.deepEqual(await ports.workspaceAccess.entitlements(request(),input),value)
 for(const edit of [s=>s.userId=randomUUID(),s=>s.organisationId=randomUUID(),s=>s.applicationId='srm',
  s=>s.expiresAt=new Date(Date.now()-1).toISOString(),s=>s.expiresAt=new Date(Date.now()+100000).toISOString(),
  s=>s.capabilities=['ADMIN'],s=>s.capabilities=['SEATS','SEATS'],s=>s.extra='unreviewed',
  s=>s.assignmentRef='other-purpose',s=>s.assignmentUntil=new Date(Date.now()-1).toISOString(),s=>s.status=null]){
  value=snapshot();edit(value);await assert.rejects(ports.workspaceAccess.entitlements(request(),input))
 }
 value={...snapshot(),status:'INACTIVE',assignmentRef:null,assignmentUntil:null,capabilities:[]}
 assert.equal((await ports.workspaceAccess.entitlements(request(),input)).status,'INACTIVE')
 const before=calls;await assert.rejects(ports.workspaceAccess.entitlements(new Request(sourceOrigin+'/x'),input));assert.equal(calls,before)
 assert.throws(()=>createOrganisationServiceConnections({...configuration,accessProjectionSchemaDigest:'0'.repeat(64)}))
 assert.throws(()=>createOrganisationServiceConnections({...configuration,accessProjectionSchemaDigest:undefined}))
 assert.throws(()=>createOrganisationServiceConnections({...configuration,workspacePeer:{...workspacePeer,routes:[...workspacePeer.routes,{method:'GET',path:'/operator',maximumRequestBytes:0,requireIdempotencyKey:false}]}}))
})
