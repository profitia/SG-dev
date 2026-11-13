import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createPeerOperationSigner} from '../../../packages/platform-contracts/src/peer-operation.mjs'
import {createWorkspaceAccess,readWorkspaceConfiguration,workspaceAccessDigest,workspaceIdentityDigest,workspaceEntitlementsDigest} from '../dist/workspace-access.js'
import {workspaceInstallationPlan} from '../scripts/install-workspace-access.mjs'
const origin='https://limits-development.onrender.com',source='https://identity.example.test'
function fixture(){
 const uid=randomUUID(),oid=randomUUID(),key=randomBytes(32),peer={environment:'development',callerApplicationId:'identity-runtime-development',receiverApplicationId:'package-limits-development',sourceOrigin:source,targetOrigin:origin,keyId:'registration-limits-v1',key,
  routes:[{method:'GET',path:'/v1/organisation-access',maximumRequestBytes:0,requireIdempotencyKey:false}],internalOrigins:[]}
 const f={uid,oid,peer,queries:[],commits:0,rollbacks:0,identityCalls:0,wrong:false,expired:false,status:'PENDING_PACKAGE'}
 const connection={query:async(sql,args)=>{f.queries.push({sql,args});if(sql==='COMMIT'){f.commits++;return {rows:[]}}if(sql==='ROLLBACK'){f.rollbacks++;return {rows:[]}}
  if(sql.includes('pg_current_xact_id'))return {rows:[{tx:'12'}]}
  if(sql.includes('profitia_limits.workspace_access('))return {rows:[{data:{userId:f.wrong?randomUUID():uid,organisationId:oid,applicationId:'spendguru',status:f.status,expiresAt:new Date(f.expired?Date.now()-1:args[3]).toISOString()}}]}
  return {rows:[]}},release(){}}
 const surface=createWorkspaceAccess({configuration:{peer,commandKey:key},limits:{connect:async()=>connection},identity:{},withIdentity:async(_request,fn)=>{f.identityCalls++;return fn({actor:{userId:uid,expiresAt:new Date(Date.now()+5000).toISOString()},workspaceContext:async()=>({userId:uid,organisationId:oid,applicationId:'spendguru',projectionRef:''})})}})
 return {...f,state:f,surface,signed:()=>createPeerOperationSigner(peer)(new Request(origin+'/v1/organisation-access',{headers:{authorization:'Bearer synthetic-original-bearer'}}))}
}
test('workspace bridge is explicit, exact-schema and distinct-key opt-in',()=>{
 assert.equal(readWorkspaceConfiguration({},origin),undefined)
 const valid={LIMITS_WORKSPACE_ACCESS_ENABLED:'true',TARGET_ENVIRONMENT:'development',LIMITS_WORKSPACE_SCHEMA_DIGEST:workspaceAccessDigest,LIMITS_WORKSPACE_IDENTITY_SCHEMA_DIGEST:workspaceIdentityDigest,
 LIMITS_WORKSPACE_PEER_KEY:'a'.repeat(64),LIMITS_WORKSPACE_COMMAND_KEY:'b'.repeat(64),LIMITS_WORKSPACE_SOURCE_ORIGIN:source,LIMITS_WORKSPACE_KEY_ID:'registration-limits-v1'}
 assert.equal(readWorkspaceConfiguration(valid,origin).peer.sourceOrigin,source)
 assert.throws(()=>readWorkspaceConfiguration({...valid,LIMITS_WORKSPACE_ENTITLEMENTS_ENABLED:'true'},origin))
 const extended=readWorkspaceConfiguration({...valid,LIMITS_WORKSPACE_ENTITLEMENTS_ENABLED:'true',LIMITS_WORKSPACE_ENTITLEMENTS_SCHEMA_DIGEST:workspaceEntitlementsDigest},origin);assert.equal(extended.entitlements,true);assert.equal(extended.peer.routes.length,2)
 assert.throws(()=>readWorkspaceConfiguration({LIMITS_WORKSPACE_ENTITLEMENTS_ENABLED:'true'},origin))
 for(const patch of [{TARGET_ENVIRONMENT:'production'},{LIMITS_WORKSPACE_SCHEMA_DIGEST:'0'.repeat(64)},{LIMITS_WORKSPACE_IDENTITY_SCHEMA_DIGEST:'0'.repeat(64)},{LIMITS_WORKSPACE_PEER_KEY:''},{LIMITS_WORKSPACE_SOURCE_ORIGIN:'https://evil.example/path'}])assert.throws(()=>readWorkspaceConfiguration({...valid,...patch},origin))
 assert.equal(workspaceInstallationPlan().effects.productGrantsCreated,false);assert.equal(workspaceInstallationPlan().limits.enabledByDefault,false)
})
test('only verified signed peer can reach official identity and actual scoped package query',async()=>{
 const f=fixture()
 await assert.rejects(f.surface.read(new Request(origin+'/v1/organisation-access',{headers:{authorization:'Bearer synthetic-original-bearer'}})),e=>e.status===401)
 assert.equal(f.state.identityCalls,0);assert.equal(f.state.queries.length,0)
 const result=await f.surface.read(await f.signed());assert.equal(result.status,'PENDING_PACKAGE');assert.equal(f.state.identityCalls,1);assert.equal(f.state.commits,1)
 const call=f.state.queries.find(q=>q.sql.includes('profitia_limits.workspace_access('));assert.equal(call.args[0],f.uid);assert.equal(call.args[1],f.oid);assert.equal(call.args[2],'spendguru');assert.equal(call.args[5],'')
 assert(!f.state.queries.some(q=>q.sql.includes('profitia_limits.api(')))
})
test('wrong-actor and expired commercial responses roll back and cannot unlock workspace',async()=>{
 for(const field of ['wrong','expired']){
  const f=fixture();f.state[field]=true;await assert.rejects(f.surface.read(await f.signed()),e=>e.status===503);assert.equal(f.state.commits,0);assert.equal(f.state.rollbacks,1)
 }
})
