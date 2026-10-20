import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {OperationContext} from '@profitia/platform-contracts/operation-context'
import {isOperationDenied} from '@profitia/platform-contracts/operation-context'
import type {SectionEnvelope,VerclyKysData,JdgRegistryData} from '@profitia/srm-xray'
import {projectSensitiveSupplierOutput,readPrivateSupplier,readPrivateSupplierSelection,privateSupplierReportId,privateSupplierExportId,sensitiveActorSecret} from './supplier-sensitive-operation'
import type {PoolClient} from 'pg'
import {verifyPeselToken} from './pesel-reveal'
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222'
const U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',V='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',S='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const secret='synthetic-sensitive-projection-secret-32-characters',nip='8650004194'
const selection={nip,entityType:'COMPANY' as const,section:'kys' as const}
function context(operation:OperationContext['operation']='supplier.private.read'):OperationContext{
 return {actorKind:'HUMAN',actorId:U,subjectUserId:U,organisationId:A,operation,resource:{dataClass:'ORGANISATION_PRIVATE',ownerOrganisationId:A,ownerUserId:null,version:S,
  privateSupplier:{nip,entityType:'COMPANY',snapshotId:S,retentionUntil:new Date(Date.now()+60000).toISOString()}}} as OperationContext
}
function envelope():SectionEnvelope<VerclyKysData>{return {status:'SUCCESS',source:{provider:'VERCLY',model:'KYS_NIP',recordId:'synthetic'},retrievedAt:new Date().toISOString(),effectiveAt:null,warnings:[],
 data:{correlationId:null,reportId:'synthetic',isComplete:true,queriedRegisters:[],stateAsOf:null,pepMatches:[],relatedPersons:[{fullName:'SYNTHETIC_PERSON',pesel:'12345678901',birthDate:null,positions:[],citizenship:[],foundIn:[],sanctionsMatch:false,pepMatch:false}],beneficialOwners:[]}}}
function read(){return {kind:'READ',snapshotId:S,...selection,envelope:envelope(),exportRef:'a'.repeat(64)}}
const denied=(value:unknown,c=context())=>assert.rejects(projectSensitiveSupplierOutput(value,c,secret),isOperationDenied)

test('private selection is canonical, immutable, finite and tied to supplier/entity/section',()=>{
 const value=readPrivateSupplierSelection(selection);assert(Object.isFrozen(value));assert.deepEqual(value,selection)
 assert.equal(privateSupplierReportId(value),'supplier-private-report:kys:COMPANY:'+nip)
 assert.equal(privateSupplierExportId(nip,'JDG'),'supplier-private-export:kys:JDG:'+nip)
 for(const value of[{...selection,nip:'0000000000'},{...selection,nip:'8650004195'},{...selection,section:'general'},{...selection,section:'jdg'},{...selection,organisationId:B},null,[]])assert.throws(()=>readPrivateSupplierSelection(value),isOperationDenied)
 let invoked=false;const getter={...selection};Object.defineProperty(getter,'nip',{enumerable:true,get(){invoked=true;return nip}})
 assert.throws(()=>readPrivateSupplierSelection(getter),isOperationDenied);assert.equal(invoked,false)
})
test('reference key is stable for an internal actor and cannot transfer to another organization or user',()=>{
 const a=sensitiveActorSecret(secret,A,U);assert.equal(a,sensitiveActorSecret(secret,A,U));assert.notEqual(a,sensitiveActorSecret(secret,A,V));assert.notEqual(a,sensitiveActorSecret(secret,B,U))
 assert.throws(()=>sensitiveActorSecret('short',A,U),isOperationDenied)
})
test('classified empty snapshots remain readable and never acquire an export reference',async()=>{
 for(const status of ['EMPTY','ERROR'] as const){
  const c=context(),e={...envelope(),status,data:null}
  const client={query:async()=>({rows:[{section:'kys',envelope:e,projectionVersion:2,projectionHash:'a'.repeat(32),dataClass:'KYS_PERSONAL',
   retrievedAt:e.retrievedAt,retentionUntil:c.resource.privateSupplier!.retentionUntil}]})} as unknown as PoolClient
  const value=await readPrivateSupplier(c,client,secret)
  assert.equal(value.exportRef,null);assert.equal(value.envelope.data,null)
  const body=await(await projectSensitiveSupplierOutput(value,c,secret)).json()
  assert.equal(body.section.status,status);assert.equal(body.section.data,null);assert.equal(body.privateReport.exportRef,null)
  await denied({...value,exportRef:'a'.repeat(64)},c)
 }
})
test('KYS read masks plaintext identifiers and mints short-lived actor and organization scoped references',async()=>{
 const c=context(),value=read(),original=JSON.stringify(value),r=await projectSensitiveSupplierOutput(value,c,secret)
 assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('vary'),'Cookie, Authorization')
 const body=await r.json();assert(!JSON.stringify(body).includes('12345678901'));assert.equal(body.section.source,undefined);assert.equal(body.section.data.relatedPersons[0].pesel,null)
 const token=body.section.data.relatedPersons[0].peselRevealToken
 assert.deepEqual(verifyPeselToken(sensitiveActorSecret(secret,A,U),token),{snapshotId:S,list:'relatedPersons',index:0})
 assert.equal(verifyPeselToken(sensitiveActorSecret(secret,A,V),token),null);assert.equal(verifyPeselToken(sensitiveActorSecret(secret,B,U),token),null)
 assert.equal(verifyPeselToken(sensitiveActorSecret(secret,A,U),token,Date.parse(c.resource.privateSupplier!.retentionUntil)),null)
 assert.equal(body.privateReport.snapshotId,S);assert.equal(body.privateReport.nip,nip);assert.equal(JSON.stringify(value),original)
})
test('projection refuses another organization, personal owner, service actor, snapshot, supplier and expired or invalid retention',async()=>{
 for(const change of[(c:OperationContext)=>{c.organisationId=B},(c:OperationContext)=>{c.resource={...c.resource,ownerUserId:V}},(c:OperationContext)=>{c.actorKind='SERVICE'},(c:OperationContext)=>{c.subjectUserId=V},(c:OperationContext)=>{c.resource={...c.resource,version:V}},(c:OperationContext)=>{c.resource={...c.resource,dataClass:'SHARED_KNOWLEDGE'}},(c:OperationContext)=>{c.resource={...c.resource,privateSupplier:{...c.resource.privateSupplier!,retentionUntil:'invalid'}}},(c:OperationContext)=>{c.resource={...c.resource,privateSupplier:{...c.resource.privateSupplier!,retentionUntil:new Date(Date.now()-1).toISOString()}}}]){const c=context();change(c);await denied(read(),c)}
 for(const v of[{...read(),snapshotId:V},{...read(),nip:'5272443955'},{...read(),entityType:'JDG'},{...read(),extra:true}])await denied(v)
})
test('JDG display masks semantic identity fields recursively and leaves the original envelope intact',async()=>{
 const data:JdgRegistryData={entries:[{recordId:'synthetic',name:'SYNTHETIC',nip,regon:null,status:'Aktywny',fields:[{key:'group',label:'Group',value:null,children:[{key:'pesel',label:'PESEL',value:'12345678901',children:[]},{key:'address',label:'Adres',value:'TEST_ADDRESS',children:[]}]}]}]} as JdgRegistryData
 const c=context();c.resource={...c.resource,privateSupplier:{...c.resource.privateSupplier!,entityType:'JDG'}}
 const e={status:'SUCCESS',source:{provider:'CEIDG',model:'CEIDG_V3',recordId:'synthetic'},retrievedAt:new Date().toISOString(),effectiveAt:null,warnings:[],data} as SectionEnvelope<JdgRegistryData>
 const before=JSON.stringify(e),r=await projectSensitiveSupplierOutput({...read(),entityType:'JDG',section:'jdg',envelope:e,exportRef:null},c,secret)
 const body=await r.json();assert(!JSON.stringify(body).includes('12345678901'));assert(JSON.stringify(body).includes('TEST_ADDRESS'));assert.equal(JSON.stringify(e),before)
})
test('reveal output is separate from read and accepts only an exact private identifier result',async()=>{
 const c=context('supplier.private.reveal'),v={kind:'REVEAL',snapshotId:S,pesel:'12345678901'}
 assert.deepEqual(await (await projectSensitiveSupplierOutput(v,c,secret)).json(),{pesel:'12345678901'})
 assert.equal((await projectSensitiveSupplierOutput({...v,pesel:null},c,secret)).status,404)
 for(const bad of[{...v,pesel:'bad'},{...v,pesel:'123456789012'},{...v,snapshotId:V},{...v,privateData:'forbidden'},read()])await denied(bad,c)
 await denied(v,context('supplier.report.read'))
})
function pdf(changes:Record<string,string>={},status=200,bytes='%PDF-1.7\nSYNTHETIC_ONLY'){
 const filename='KYS_'+nip+'_2026-10-19.pdf';return new Response(bytes,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization','Content-Type':'application/pdf','X-Download-Filename':filename,'Content-Disposition':`attachment; filename="${filename}"`,...changes}})
}
test('private PDF is released only with exact supplier filename, private headers and PDF bytes',async()=>{
 const c=context('supplier.private.export'),r=pdf();assert.equal(await projectSensitiveSupplierOutput({kind:'EXPORT',snapshotId:S,response:r},c,secret),r)
 for(const response of[pdf({'Cache-Control':'public'}),pdf({Vary:'Cookie'}),pdf({'Content-Type':'text/html'}),pdf({'X-Download-Filename':'KYS_5272443955_2026-10-19.pdf'}),pdf({'Content-Disposition':'inline'}),pdf({},200,'<html>PRIVATE</html>'),pdf({},409)])await denied({kind:'EXPORT',snapshotId:S,response},c)
 await denied({kind:'EXPORT',snapshotId:V,response:pdf()},c)
})
test('expected private export unavailability remains an audited typed result without exposing data or a forged PDF',async()=>{
 const c=context('supplier.private.export')
 for(const status of[404,409,410] as const){
  const r=await projectSensitiveSupplierOutput({kind:'EXPORT_UNAVAILABLE',snapshotId:S,status},c,secret)
  assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('content-type'),'application/json')
  assert.deepEqual(Object.keys(await r.json()),['error'])
 }
 for(const value of[{kind:'EXPORT_UNAVAILABLE',snapshotId:V,status:409},{kind:'EXPORT_UNAVAILABLE',snapshotId:S,status:500},
  {kind:'EXPORT_UNAVAILABLE',snapshotId:S,status:409,error:'PRIVATE_BODY'}])await denied(value,c)
})
