import test from 'node:test'
import assert from 'node:assert/strict'
import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import {createCachedSupplierIdentityHttpHandler} from './supplier-cached-identity-runtime'
import type {SrmReportRuntime} from './private-runtime'
const env={TARGET_ENVIRONMENT:'development',RENDER_SERVICE_ID:'srv-db1vu6gm7kps73d0e3r0'}
const request=(body:unknown={nip:'8521021463'},options:{origin?:string;method?:string;query?:string}={})=>new Request('https://srm-development-runtime.onrender.com/api/xray/presentation/registry-selection'+(options.query??''),{method:options.method??'POST',headers:{origin:options.origin??'https://srm-development-runtime.onrender.com','content-type':'application/json'},...(options.method==='GET'?{}:{body:typeof body==='string'?body:JSON.stringify(body)})})
const runtime=(read:(input:{request:Request;organisationId:string},nip:string)=>Promise<Response>)=>({provider:'clerk',defaultOrganisationId:'11f6625d-774b-42ae-87f2-2fdaf71d0ade',supplierApi:{cachedIdentity:read}} as unknown as SrmReportRuntime)
test('HTTP read keeps the original request and server organization without an acquisition command',async()=>{
 const original=request();let calls=0
 const handler=createCachedSupplierIdentityHttpHandler(()=>runtime(async(input,nip)=>{calls++;assert.equal(input.request,original);assert.equal(input.organisationId,'11f6625d-774b-42ae-87f2-2fdaf71d0ade');assert.equal(nip,'8521021463');return Response.json({selectionRef:'a'.repeat(64)})}),{RENDER_SERVICE_ID:env.RENDER_SERVICE_ID})
 assert.equal((await handler(original)).status,200);assert.equal(calls,1)
})
test('malformed input and actor, organization or source overrides are rejected before runtime access',async()=>{
 let calls=0;const handler=createCachedSupplierIdentityHttpHandler(()=>{calls++;throw Error('must not reach runtime')},env)
 for(const req of [request({nip:'8521021463',organisationId:'other'}),request({nip:'8521021463',actorId:'other'}),request({nip:'8521021463',source:'KRS'}),request({nip:'0000000000'}),request('{'),request('x'.repeat(2100)),request({}, {method:'GET'}),request(undefined,{query:'?organisationId=other'}),request(undefined,{origin:'https://untrusted.example'})])assert.ok([400,403,405].includes((await handler(req)).status))
 assert.equal(calls,0)
})
test('separate pilots, unconfigured native runtime and current E1 denials fail closed',async()=>{
 let calls=0;const getter=()=>{calls++;return runtime(async()=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')})}
 assert.equal((await createCachedSupplierIdentityHttpHandler(getter,{...env,RENDER_SERVICE_ID:'srv-dbd5hlcipgvc73d98ukg'})(request())).status,503)
 assert.equal(calls,0)
 assert.equal((await createCachedSupplierIdentityHttpHandler(()=>({provider:'legacy_demo'}),env)(request())).status,503)
 assert.equal((await createCachedSupplierIdentityHttpHandler(getter,env)(request())).status,403)
})
