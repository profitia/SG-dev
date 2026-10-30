import test from 'node:test'
import assert from 'node:assert/strict'
import {mapMgbiGeneralRecords} from './mgbi-general'
import {mapMgbiFinancialRecords} from './mgbi-financial'
import {isStructuredFreshCompany} from './supplier-native-work-store'
import {createSrmSupplierOperationHandler} from './supplier-acquisition-http'
import type {SrmSupplierApi} from './supplier-api-composition'

const nip='5272443955',krs='0000217580',at='2026-10-30T06:00:00.000Z'
function fixture(){
 const wp={id:'a'.repeat(24),identifiers:{pl_nip:nip,pl_krs:krs},content:{current_excerpt:{naglowekA:{numerKRS:krs},dane:{dzial1:{danePodmiotu:{nazwa:'Synthetic company',formaPrawna:'SPÓŁKA AKCYJNA'}}}}}}
 const rdf={id:'b'.repeat(24),identifiers:{pl_nip:nip,pl_krs:krs},document:{type:'financial_statement',period_from_date:'2025-01-01',period_to_date:'2025-12-31',is_ias_compliant:false},content:{schema:{name:'JednostkaInnaWZlotych'},standardized_fields:{bs:{a_ca_cfy:'300',lae_lapfl_stl_cfy:'200'}}}}
 const g={...mapMgbiGeneralRecords([wp],{type:'NIP' as const,value:nip},at),rawResponse:{pages:[{count:1,results:[wp]}],recordCount:1}}
 const f={...mapMgbiFinancialRecords([rdf],{type:'NIP' as const,value:nip},at,1,g.section.data?.registryHistory),rawResponse:{pages:[{count:1,results:[rdf]}],recordCount:1}}
 return {g,f}
}
test('only complete identified structured MGBI evidence qualifies for the atomic postfetch path',()=>{
 const {g,f}=fixture();assert.equal(isStructuredFreshCompany(nip,g,f),true)
 assert.equal(isStructuredFreshCompany('5260250274',g,f),false)
})
test('only an identified main Development company response carries the non-authorizing body-read hint',async()=>{
 const organization='11111111-1111-4111-8111-111111111111';
 for(const [origin,returnedNip,expected]of[
  ['https://srm-development-runtime.onrender.com',nip,nip],
  ['https://srm-development-runtime.onrender.com','5260250274',null],
  ['https://srm-staging-runtime.onrender.com',nip,null],
 ] as const){
  const api={ready:async()=>({known:true,response:Response.json({identity:{nip:returnedNip},metadata:{nip:returnedNip}})})} as unknown as SrmSupplierApi;
  const response=await createSrmSupplierOperationHandler('search',api,organization)(new Request(origin+'/api/xray/search',{
   method:'POST',headers:{origin,'content-type':'application/json','idempotency-key':organization},body:JSON.stringify({identifier:nip})}));
  assert.equal(response.status,200);assert.equal(response.headers.get('X-SRM-Prepared-Company'),expected);
  assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 }
});
for(const [label,change] of [
 ['ambiguous identity',(g:any)=>g.errorCode='COMPANY_IDENTITY_AMBIGUOUS'],
 ['provider error',(_g:any,f:any)=>f.errorCode='MGBI_UNAVAILABLE'],
 ['missing financial data',(_g:any,f:any)=>f.section.data=null],
 ['empty financial result',(_g:any,f:any)=>f.section.status='EMPTY'],
 ['foreign registry NIP',(g:any)=>g.rawResponse.pages[0].results[0].identifiers.pl_nip='5260250274'],
 ['foreign financial NIP',(_g:any,f:any)=>f.rawResponse.pages[0].results[0].identifiers.pl_nip='5260250274'],
 ['incomplete page inventory',(_g:any,f:any)=>f.rawResponse.recordCount=2],
 ['missing KRS',(g:any)=>g.section.data.krs=null],
 ['restricted company',(g:any)=>g.section.data.registrationStatus='DEREGISTERED'],
 ['IAS requiring its original path',(_g:any,f:any)=>f.rawResponse.pages[0].results[0].document.is_ias_compliant=true],
 ['absent General evidence',(g:any)=>delete g.rawResponse],
 ['absent Financial evidence',(_g:any,f:any)=>delete f.rawResponse],
] as const)test('postfetch keeps original handling for '+label,()=>{const {g,f}=fixture();change(g,f);assert.equal(isStructuredFreshCompany(nip,g,f),false)})
