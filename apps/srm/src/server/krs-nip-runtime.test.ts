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
 const calls:string[]=[],api={jdg:async()=>{calls.push('ceidg');return Response.json({section:{status}})},company:async()=>{calls.push('mgbi');return Response.json({...emptyCard,identity:{nip,krs,name:'SYNTHETIC'}})}} as unknown as SrmSupplierApi
 return {calls,api}
}
test('CEIDG-confirmed KRS path returns verified selection and General without any MGBI request',async()=>{
 const f=fixture(),runtime=createKrsNipCompany({api:f.api,observe:()=>{},resolve:async()=>({status:'PRIMARY',selection,general})})
 const response=await runtime.company(input,true),value=await response.json()
 assert.equal(response.status,200);assert.deepEqual(f.calls,[]);assert.equal(value.registryRoute.provider,'KRS');assert.equal(value.financial.status,'NOT_REQUESTED');assert.equal(value.krsSelection.nip,nip);assert.equal(value.general.source,undefined)
})
test('a direct company endpoint cannot bypass CEIDG classification',async()=>{
 for(const status of ['SUCCESS','ERROR','PARTIAL']){
  const f=fixture(status),runtime=createKrsNipCompany({api:f.api,observe:()=>{},resolve:async()=>{throw Error('No GUS after CEIDG hit/error')}})
  assert.equal((await runtime.company(input,false)).status,409);assert.deepEqual(f.calls,['ceidg'])
 }
})
test('missing GUS data executes the original company flow once and exposes bounded fallback reason',async()=>{
 const f=fixture(),runtime=createKrsNipCompany({api:f.api,observe:()=>{},resolve:async()=>({status:'FALLBACK',reason:'GUS_NO_RECORD'})})
 const response=await runtime.company(input,false),value=await response.json();assert.deepEqual(f.calls,['ceidg','mgbi']);assert.deepEqual(value.registryRoute,{provider:'MGBI',fallbackReason:'GUS_NO_RECORD'})
})
test('identity errors and E1 denials cannot purchase fallback or publish another company',async()=>{
 for(const resolve of [async()=>{throw Error('RESOURCE_SCOPE_MISMATCH')},async()=>({status:'PRIMARY' as const,selection:{...selection,nip:'7740001454'},general})]){
  const f=fixture(),runtime=createKrsNipCompany({api:f.api,observe:()=>{},resolve});await assert.rejects(runtime.company(input,true));assert.deepEqual(f.calls,[])
 }
})
