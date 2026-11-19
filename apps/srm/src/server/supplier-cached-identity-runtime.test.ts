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

// Security regressions for current-source continuation; frozen M2 fixtures stay intact.
test('immutable M2 digest cannot be substituted by an admitted current source',async()=>{
 const {readFileSync}=await import('node:fs'),{execFileSync}=await import('node:child_process')
 const {srmAssistantM2Predecessor,SRM_ASSISTANT_M2_PATHS}=await import('../../scripts/assistant-m2-integrity.mjs')
 const root=new URL('../../../../',import.meta.url),file='apps/srm/assistant-context-integration.json'
 const current=(p:string)=>readFileSync(new URL(p,root)),historical=(sha:string,p:string)=>execFileSync('git',['cat-file','blob',sha+':'+p],{cwd:root})
 assert(srmAssistantM2Predecessor(current,historical))
 const changed=JSON.parse(current(file).toString());changed.sourceDigests[SRM_ASSISTANT_M2_PATHS[0]]='0'.repeat(64)
 assert.throws(()=>srmAssistantM2Predecessor((p:string)=>p===file?Buffer.from(JSON.stringify(changed)):current(p),historical),{code:'ERR_ASSERTION'})
})
test('current X-Ray source projection rejects callback substitution despite an admitted checkout',async()=>{
 const {readFileSync}=await import('node:fs'),{execFileSync}=await import('node:child_process')
 const {assertXrayAppShellPresentation}=await import('../../scripts/xray-style-acceptance.mjs')
 const root=new URL('../../../../',import.meta.url),current=(p:string)=>readFileSync(new URL(p,root)),historical=(sha:string,p:string)=>execFileSync('git',['cat-file','blob',sha+':'+p],{cwd:root})
 const receipt=JSON.parse(current('apps/srm/operation-integration.json').toString()),changed='packages/srm-xray/src/full-report-operations.ts'
 assert.doesNotThrow(()=>assertXrayAppShellPresentation(receipt,current,historical))
 assert.throws(()=>assertXrayAppShellPresentation(receipt,(p:string)=>p===changed?Buffer.concat([current(p),Buffer.from('UNACCEPTED')]):current(p),historical),{code:'ERR_ASSERTION'})
})
