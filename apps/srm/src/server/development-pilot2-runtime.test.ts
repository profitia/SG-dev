import test from 'node:test'
import assert from 'node:assert/strict'
import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import {composeDevelopmentPilot2,developmentPilot2Enabled} from './development-pilot2-runtime'
import {readSrmPrivateReportConfiguration} from './private-runtime'
const nip='9511855233',krs='0000007163',ref='KRS:'+krs+':'+ 'a'.repeat(64)
const env={TARGET_ENVIRONMENT:'development',RENDER_SERVICE_ID:'srv-db1vu6gm7kps73d0e3r0',RENDER_GIT_COMMIT:'a'.repeat(40),SRM_DEVELOPMENT_PILOT2_LOOKUP:'true'}
test('lookup adoption is explicit and limited to the existing main Development service',()=>{
 assert.equal(developmentPilot2Enabled({}),false)
 assert.equal(developmentPilot2Enabled(env),true)
 for(const mutation of [{TARGET_ENVIRONMENT:'staging'},{TARGET_ENVIRONMENT:'production'},{RENDER_SERVICE_ID:'srv-dbeh6srrjlhs73fmikrg'},
  {SRM_DEVELOPMENT_PILOT2_LOOKUP:'yes'},{RENDER_GIT_COMMIT:'main'}])assert.throws(()=>developmentPilot2Enabled({...env,...mutation}))
 assert.throws(()=>readSrmPrivateReportConfiguration({...env,PROFITIA_AUTH_PROVIDER:'legacy_demo'}))
})
function fixture(){
 const calls:string[]=[],org='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 const api={known:async(scope:{organisationId:string},value:string)=>{assert.equal(scope.organisationId,org);assert.equal(value,nip);calls.push('current-human');return false},
  company:async()=>{calls.push('mgbi-general');throw Error('Unexpected paid fallback')},jdg:async()=>{throw Error('Unexpected CEIDG')},prepareKrsFinancial:async()=>{calls.push('financial');throw Error('Unexpected financial')}}
 const registry={resolve:async()=>{calls.push('gus-krs');return {status:'PRIMARY',selection:{identity:{selectedKrs:krs,evidenceRef:ref,identity:{nip,officialName:'Synthetic company'}},
  general:{source:{provider:'KRS'},data:{nip,krs},status:'SUCCESS'}}}},identify:async()=>{calls.push('public-reference');return nip},
  accepted:async()=>{calls.push('accepted');throw Error('Unexpected continuation')}}
 const options={api:api as never,organisationId:org,registry:async()=>registry as never,
  project:async<T>(_request:Request,_nip:string,value:T)=>{calls.push('protected-result');return value},readReport:async()=>Response.json(null)}
 const request=new Request('https://srm-development-runtime.onrender.com/api/xray/search',{method:'POST'})
 return {api,registry,options,calls,input:{request,organisationId:org,command:{kind:'SUPPLIER_REPORT' as const,nip},idempotencyKey:'development-pilot2-fixture-001'}}
}
test('main lookup checks current HUMAN authority before GUS/KRS and returns the existing continuation shape',async()=>{
 const f=fixture(),runtime=composeDevelopmentPilot2(f.options)
 const result=await (await runtime.nip.search(f.input)).json()
 assert.deepEqual(f.calls,['current-human','gus-krs','protected-result'])
 assert.equal(result.card.identity.nip,nip);assert.equal(result.registryRoute.provider,'KRS')
 assert.equal(result.krsSelection.selectionRef,ref);assert.equal(result.card.financial.status,'NOT_REQUESTED')
 assert.equal(await runtime.available(f.input.request),false,'Name-search UI remains unchanged')
})
test('revocation prevents Source resolution and licensed Financial acquisition',async()=>{
 const f=fixture();f.api.known=async()=>{throw new OperationDenied('PERMISSION_DENIED')}
 const runtime=composeDevelopmentPilot2(f.options)
 await assert.rejects(runtime.nip.search(f.input))
 assert.deepEqual(f.calls,[])
 await assert.rejects(runtime.api.lookup(f.input.request,ref,f.input.idempotencyKey))
 assert.deepEqual(f.calls,['public-reference'])
})
test('a Source authority failure cannot trigger MGBI fallback',async()=>{
 const f=fixture();f.registry.resolve=async()=>{throw new OperationDenied('POLICY_UNAVAILABLE')}
 await assert.rejects(composeDevelopmentPilot2(f.options).nip.search(f.input))
 assert.deepEqual(f.calls,['current-human'])
})
test('a different requested organisation is refused before discovery or paid effects',async()=>{
 const f=fixture()
 await assert.rejects(composeDevelopmentPilot2(f.options).nip.search({...f.input,organisationId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}),
  (error:unknown)=>(error as {reasonCode:string}).reasonCode==='RESOURCE_SCOPE_MISMATCH')
 assert.deepEqual(f.calls,[])
})
test('revocation at the final protected projection cannot release the acquired General',async()=>{
 const f=fixture();f.options.project=async()=>{throw new OperationDenied('PERMISSION_DENIED')}
 await assert.rejects(composeDevelopmentPilot2(f.options).nip.search(f.input))
 assert.deepEqual(f.calls,['current-human','gus-krs'])
})
