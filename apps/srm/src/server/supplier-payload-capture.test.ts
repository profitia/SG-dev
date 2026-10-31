import test from 'node:test'
import assert from 'node:assert/strict'
import type {PoolClient} from 'pg'
import type {GeneralCompanyData,SectionEnvelope} from '@profitia/srm-xray'
import {OperationDenied,operationPayloadDigest,type Json,type OperationContext} from '@profitia/platform-contracts/operation-context'
import {createSrmSupplierNativeWorkStore} from './supplier-native-work-store'
import type {SupplierNativeWork} from './supplier-request-work'

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
