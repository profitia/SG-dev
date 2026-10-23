import test from 'node:test'
import assert from 'node:assert/strict'
import {createKrsNipCompany} from './krs-nip-runtime'
import type {SrmSupplierApi,SupplierHttpInput} from './supplier-api-composition'
import {emptyCard} from '../demo/fixture'
const nip='5213415549',krs='0000271457'
const general={...emptyCard.general,status:'SUCCESS' as const,source:{provider:'KRS' as const,model:'OdpisAktualny',recordId:krs},data:{legalName:'SYNTHETIC COMPANY',legalForm:null,krs,nip,regon:'140790901',registeredAddress:null,registeredAt:null,mainPkd:null}}
const selection={nip,krs,name:'SYNTHETIC COMPANY',locality:null,selectionRef:'KRS:'+krs+':'+'a'.repeat(64)}
const input:SupplierHttpInput={request:new Request('https://srm.example/api/xray/search'),organisationId:'11111111-1111-4111-8111-111111111111',idempotencyKey:'synthetic-request-key-12345',command:{kind:'SUPPLIER_REPORT',nip}}
function fixture(status='EMPTY'){
 const calls:string[]=[],api={jdg:async()=>{calls.push('ceidg');return Response.json({section:{status,data:status==='SUCCESS'||status==='PARTIAL'?{entries:[{nip}]}:null}})},company:async()=>{calls.push('mgbi');return Response.json({...emptyCard,general:{...general,source:{provider:'MGBI'}},identity:{nip,krs,name:'SYNTHETIC'}})}} as unknown as SrmSupplierApi
 return {calls,api}
}
test('GUS/KRS-first path returns verified selection without any CEIDG or MGBI General request',async()=>{
 const f=fixture(),runtime=createKrsNipCompany({api:f.api,observe:()=>{},resolve:async()=>({status:'PRIMARY',selection,general})})
 const response=await runtime.company(input,false),value=await response.json()
 assert.equal(response.status,200);assert.deepEqual(f.calls,[]);assert.equal(value.registryRoute.provider,'KRS');assert.equal(value.financial.status,'NOT_REQUESTED');assert.equal(value.krsSelection.nip,nip);assert.equal(value.general.source,undefined)
})
test('only registry absence checks CEIDG; a JDG hit never buys MGBI and a direct company entry stays explicit',async()=>{
 for(const status of ['SUCCESS','PARTIAL']){
  const f=fixture(status),runtime=createKrsNipCompany({api:f.api,observe:()=>{},resolve:async()=>({status:'FALLBACK',reason:'GUS_NOT_LEGAL_ENTITY'})})
  const result=await runtime.search(input),value=await result.json()
  assert.equal(result.status,200);assert.equal(value.entityType,'JDG');assert.equal(value.nip,nip);assert.deepEqual(f.calls,['ceidg'])
  f.calls.length=0;assert.equal((await runtime.company(input,false)).status,409);assert.deepEqual(f.calls,['ceidg'])
 }
})
test('missing GUS data executes the original company flow once and exposes bounded fallback reason',async()=>{
 const f=fixture(),runtime=createKrsNipCompany({api:f.api,observe:()=>{},resolve:async()=>({status:'FALLBACK',reason:'GUS_NO_RECORD'})})
 const response=await runtime.company(input,false),value=await response.json();assert.deepEqual(f.calls,['ceidg','mgbi']);assert.deepEqual(value.registryRoute,{provider:'MGBI',fallbackReason:'GUS_NO_RECORD'})
})
test('search keeps the existing response shape while bypassing CEIDG for a verified KRS company',async()=>{
 const f=fixture('ERROR'),runtime=createKrsNipCompany({api:f.api,observe:()=>{},resolve:async()=>({status:'PRIMARY',selection,general})})
 const r=await runtime.search(input),body=await r.json();assert.equal(r.status,200)
 assert.equal(body.entityType,'COMPANY');assert.equal(body.card.identity.nip,nip);assert.equal(body.registryRoute.provider,'KRS');assert.equal(body.krsSelection.krs,krs);assert.deepEqual(f.calls,[])
})
test('a GUS/KRS technical timeout does not classify as CEIDG absence or repeat paid fallback',async()=>{
 const f=fixture('ERROR'),runtime=createKrsNipCompany({api:f.api,observe:()=>{},resolve:async()=>({status:'FALLBACK',reason:'PRIMARY_DEADLINE'})})
 const r=await runtime.search(input),body=await r.json();assert.equal(r.status,200);assert.equal(body.registryRoute.fallbackReason,'PRIMARY_DEADLINE');assert.deepEqual(f.calls,['mgbi'])
})
test('CEIDG error after registry absence is not evidence for paid MGBI fallback',async()=>{
 const f=fixture('ERROR'),runtime=createKrsNipCompany({api:f.api,observe:()=>{},resolve:async()=>({status:'FALLBACK',reason:'GUS_KRS_MISSING'})})
 assert.equal((await runtime.search(input)).status,503);assert.deepEqual(f.calls,['ceidg'])
})
for(const reason of ['GUS_NO_RECORD','PRIMARY_DEADLINE'])test('an empty fallback never becomes a fabricated company or buys MGBI twice: '+reason,async()=>{
 const f=fixture(),api={...f.api,company:async()=>{f.calls.push('mgbi');return Response.json({...emptyCard,general:{...emptyCard.general,status:'EMPTY'},identity:{nip,krs:null,name:null}})}}
 const runtime=createKrsNipCompany({api,observe:()=>{},resolve:async()=>({status:'FALLBACK',reason})})
 assert.equal((await runtime.search(input)).status,404);assert.deepEqual(f.calls,reason==='GUS_NO_RECORD'?['ceidg','mgbi']:['mgbi','ceidg'])
})
test('identity errors and E1 denials cannot purchase fallback or publish another company',async()=>{
 for(const resolve of [async()=>{throw Error('RESOURCE_SCOPE_MISMATCH')},async()=>({status:'PRIMARY' as const,selection:{...selection,nip:'7740001454'},general})]){
  const f=fixture(),runtime=createKrsNipCompany({api:f.api,observe:()=>{},resolve});await assert.rejects(runtime.company(input,true));assert.deepEqual(f.calls,[])
 }
})
