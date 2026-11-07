import test from 'node:test'
import assert from 'node:assert/strict'
import type {PoolClient} from 'pg'
import type {GeneralCompanyData,SectionEnvelope} from '@profitia/srm-xray'
import {OperationDenied,operationPayloadDigest,type Json,type OperationContext} from '@profitia/platform-contracts/operation-context'
import {createSrmSupplierNativeWorkStore} from './supplier-native-work-store'
import type {SupplierNativeWork} from './supplier-request-work'
import {fetchMgbiPages,readPreparedMgbiPages} from './mgbi-archive'
import {mapMgbiGeneralRecords} from './mgbi-general'
import {mapMgbiFinancialRecords} from './mgbi-financial'

const org='11111111-1111-4111-8111-111111111111',user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',service='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',requestId='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const selection={organisationId:org,requestId,command:{kind:'SUPPLIER_REPORT' as const,nip:'1234563218'}}
function envelope():SectionEnvelope<GeneralCompanyData>&{warnings:string[]}{return {status:'SUCCESS',source:{provider:'MGBI',model:'pl-krs-wp-record',recordId:'synthetic-record'},retrievedAt:'2026-10-31T00:00:00.000Z',effectiveAt:null,warnings:[],data:{nip:selection.command.nip,legalName:'SYNTHETIC COMPANY',legalForm:null,krs:null,regon:null,registeredAddress:null,registeredAt:null,mainPkd:'47.11.Z',mainPkdDescription:'Synthetic activity'}}}
function fixture(options:{beforeAction?:()=>Promise<void>;denyEntry?:()=>boolean;denyOutcome?:()=>boolean}={}){
 const manifests:Json[]=[];let calls=0,queries=0
 const work:SupplierNativeWork={async run(s,unit,input,action){
  calls++;assert.deepEqual(s,selection);assert.equal(unit,'SRM_GENERAL_METADATA_READ');manifests.push(input as Json)
  if(options.denyEntry?.())throw new OperationDenied('POLICY_UNAVAILABLE')
  const payloadDigest=operationPayloadDigest(s.command),context={actorKind:'SERVICE',actorId:service,actor:{kind:'SERVICE',actorId:service,serviceId:service},operation:'job.execute',applicationId:'srm-jobs',subjectUserId:user,organisationId:org,resourceId:requestId,payloadDigest,
   requestWork:{requestId,unitId:unit,accessMode:'READ',inputDigest:operationPayloadDigest(input as Json),schemaDigest:'b'.repeat(64),transactionId:String(100+calls),policyVersion:'1',policySourceRef:'SYNTHETIC_ONLY',policyExpiresAt:new Date(Date.now()+60000).toISOString()},
   delegation:{requestId,subjectUserId:user,organisationId:org,payloadDigest,target:{operation:'supplier.report.refresh',resourceId:'supplier-request:'+payloadDigest,application:{appId:'srm'}}}} as unknown as OperationContext
  await options.beforeAction?.()
  await action(context,{query:async()=>{queries++;throw Error('Prepared PKD must not query')}} as unknown as PoolClient)
  if(options.denyOutcome?.())throw new OperationDenied('POLICY_UNAVAILABLE')
  return {requestId,unitId:unit,status:'ACCEPTED'}
 }}
 return {store:createSrmSupplierNativeWorkStore({work,namedInterestBoundaryDigest:'a'.repeat(64)}),manifests,calls:()=>calls,queries:()=>queries}
}
test('Supplier input is detached before the first await and retains the canonical Work manifest digest',async()=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve}),f=fixture({beforeAction:()=>gate}),input=envelope()
 const expected=JSON.parse(JSON.stringify(input)),pending=f.store.pkd(selection,input)
 input.data!.legalName='CALLER MUTATION';input.warnings.push('caller mutation')
 release();const result=await pending
 assert.deepEqual(result,expected.data);assert(Object.isFrozen(result));assert.equal(f.calls(),1);assert.equal(f.queries(),0)
 assert.equal((f.manifests[0] as {parameters:{bodyDigest:string}}).parameters.bodyDigest,operationPayloadDigest(expected))
})
test('a frozen caller wrapper and a previous captured result never reuse a Work authorization',async()=>{
 let denied=false;const f=fixture({denyOutcome:()=>denied}),input=Object.freeze(envelope()),expected=JSON.parse(JSON.stringify(input))
 const first=await f.store.pkd(selection,input);assert.deepEqual(first,expected.data)
 input.data!.legalName='SECOND VALUE';denied=true
 await assert.rejects(f.store.pkd(selection,input),OperationDenied)
 assert.deepEqual(first,expected.data);assert.equal(f.calls(),2)
 assert.notEqual((f.manifests[0] as {parameters:{bodyDigest:string}}).parameters.bodyDigest,(f.manifests[1] as {parameters:{bodyDigest:string}}).parameters.bodyDigest)
})
test('a refused current Work cannot release a reusable finite payload',async()=>{
 const f=fixture({denyEntry:()=>true})
 for(let i=0;i<2;i++)await assert.rejects(f.store.pkd(selection,envelope()),OperationDenied)
 assert.equal(f.calls(),2);assert.equal(f.queries(),0)
})
test('non-finite or cyclic supplier input is refused before Work admission',()=>{
 const f=fixture()
 for(const value of [Infinity,NaN]){const input=envelope();Object.assign(input.data!,{invalid:value});assert.throws(()=>f.store.pkd(selection,input),OperationDenied)}
 const input=envelope();Object.assign(input.data!,{self:input});assert.throws(()=>f.store.pkd(selection,input),OperationDenied)
 assert.equal(f.calls(),0)
})
test('Supplier capture never executes accessors or toJSON on purported provider data',()=>{
 const f=fixture();let executions=0
 const accessor=envelope();Object.defineProperty(accessor.data!,'untrusted',{enumerable:true,get(){executions++;return 'value'}})
 const converted=envelope();Object.assign(converted.data!,{toJSON(){executions++;return {nip:selection.command.nip}}})
 for(const input of [accessor,converted])assert.throws(()=>f.store.pkd(selection,input),OperationDenied)
 assert.equal(executions,0);assert.equal(f.calls(),0)
})

async function freshInput(extra:Record<string,unknown>={}){
 const nip=selection.command.nip,krs='0000000001',at='2026-10-31T00:00:00.000Z'
 const generalRecord={id:'a'.repeat(24),identifiers:{pl_nip:nip,pl_krs:krs},content:{current_excerpt:{naglowekA:{numerKRS:krs,dataRejestracjiWKRS:'2001-01-01'},dane:{dzial1:{danePodmiotu:{nazwa:'Synthetic finite payload',formaPrawna:'SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ'}}}}}}
 const financialRecord={id:'b'.repeat(24),identifiers:{pl_nip:nip,pl_krs:krs},files:[],document:{type:'financial_statement',period_from_date:'2025-01-01',period_to_date:'2025-12-31',is_ias_compliant:false},content:{standardized_fields:{bs:{a_ta_cfy:'100'},pala:{nrfs_cfy:'200',npl_cfy:'10'}}},...extra}
 const read=async(record:unknown)=>fetchMgbiPages(new URL('https://api.mgbi.pl/records'),{},new AbortController().signal,async()=>Response.json({count:1,results:[record]}))
 const gp=await read(generalRecord),fp=await read(financialRecord)
 const g={...mapMgbiGeneralRecords(gp.records,{type:'NIP',value:nip},at),rawResponse:{pages:gp.pages,recordCount:gp.count}}
 const f={...mapMgbiFinancialRecords(fp.records,{type:'NIP',value:nip},at,fp.count,g.section.data!.registryHistory!),rawResponse:{pages:fp.pages,recordCount:fp.count}}
 return {g,f}
}
function deniedFreshFixture(){
 const manifests:Json[]=[]
 const work:SupplierNativeWork={async run(_s,unit,input){assert.equal(unit,'SRM_STORE_COMPANY');manifests.push(input as Json);throw new OperationDenied('POLICY_UNAVAILABLE')}}
 return {manifests,store:createSrmSupplierNativeWorkStore({work,namedInterestBoundaryDigest:'a'.repeat(64),readyCompanyWorkBoundaryDigest:'b'.repeat(64)})}
}
test('owned MGBI reuse retains the complete canonical SDK input digest and fresh Work entry on every attempt',async()=>{
 const {g,f}=await freshInput({unmapped:{person:'synthetic-only',other:[1,null,true,'Łódź']}}),original={g:operationPayloadDigest(g as unknown as Json),f:operationPayloadDigest(f as unknown as Json)},fixture=deniedFreshFixture()
 assert(readPreparedMgbiPages(f.rawResponse.pages,1));
 for(let i=0;i<2;i++)await assert.rejects(fixture.store.freshCompany(selection,g,f),OperationDenied)
 assert.equal(fixture.manifests.length,2)
 for(const m of fixture.manifests){const p=(m as {parameters:{generalDigest:string;financialDigest:string}}).parameters;assert.equal(p.generalDigest,original.g);assert.equal(p.financialDigest,original.f)}
 const cloned=structuredClone({g,f})
 await assert.rejects(fixture.store.freshCompany(selection,cloned.g,cloned.f),OperationDenied)
 assert.deepEqual(fixture.manifests[2],fixture.manifests[0],'Unrecognized caller data retains the same strict canonical manifest')
})
test('owned pages never exempt mutable metadata, forged wrappers or accessors from Supplier capture',async()=>{
 const fixture=deniedFreshFixture();let executed=0
 for(const location of ['root','raw','metadata'] as const){
  const {g,f}=await freshInput()
  const target=location==='root'?f:location==='raw'?f.rawResponse:f.section
  Object.defineProperty(target,'malicious',{enumerable:true,get(){executed++;return 'untrusted'}})
  await assert.rejects(fixture.store.freshCompany(selection,g,f),OperationDenied)
 }
 const {g,f}=await freshInput();Object.assign(f.section,{invalid:Infinity})
 await assert.rejects(fixture.store.freshCompany(selection,g,f),OperationDenied)
 const hidden=await freshInput();Object.defineProperty(hidden.f,'toJSON',{value(){executed++;return {}},enumerable:false})
 await assert.rejects(fixture.store.freshCompany(selection,hidden.g,hidden.f),OperationDenied)
 assert.equal(executed,0);assert.equal(fixture.manifests.length,0)
})
test('owned raw pages retain the complete result depth limit, including rawResponse and pages wrappers',async()=>{
 let nested:unknown='value';for(let i=0;i<123;i++)nested={child:nested}
 const {g,f}=await freshInput({nested}),fixture=deniedFreshFixture()
 assert(readPreparedMgbiPages(f.rawResponse.pages,1),'The page itself is within the reader limit')
 await assert.rejects(fixture.store.freshCompany(selection,g,f),OperationDenied)
 assert.equal(fixture.manifests.length,0,'Wrapper depth must be counted before any Work')
})
