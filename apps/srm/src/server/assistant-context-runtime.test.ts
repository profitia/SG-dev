import test from 'node:test'
import assert from 'node:assert/strict'
import type {OperationExecutor,OperationContext} from '@profitia/platform-contracts/operation-context'
import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import type {PoolClient} from 'pg'
import {createSrmAssistantContextHandler} from './assistant-context-runtime'
import {FINANCIAL_MAPPING_VERSION} from './shared-catalog'
import {projectSupplierAssistantSummary,readSupplierAssistantSelection} from '@profitia/srm-xray/assistant-summary'
import {readSharedFinancialReport,projectSharedFinancialResponse} from './shared-financial-read'
import type {ReportReadRow} from './report-data'
const org='11111111-1111-4111-8111-111111111111',nip='8650004194',version='a'.repeat(64),at=new Date()
const selection={nip,entityType:'COMPANY' as const,krs:null,year:2025,comparisonYear:2024,statementScope:'standalone' as const}

test('M2 source build manifest covers every producer byte and preserves immutable earlier acceptance',async()=>{
 const {readFileSync}=await import('node:fs'),{execFileSync}=await import('node:child_process')
 const {srmAssistantM2Predecessor,SRM_ASSISTANT_M2_PATHS}=await import('../../scripts/assistant-m2-integrity.mjs')
 const root=new URL('../../../../',import.meta.url),current=(p:string)=>readFileSync(new URL(p,root))
 const historical=(sha:string,p:string)=>execFileSync('git',['show',sha+':'+p],{cwd:root})
 const view=srmAssistantM2Predecessor(current,historical);assert(view);assert.equal(view.manifest.grantsAccess,false)
 for(const path of SRM_ASSISTANT_M2_PATHS)assert.throws(()=>srmAssistantM2Predecessor(
  (p:string)=>p===path?Buffer.concat([current(p),Buffer.from('UNACCEPTED')]):current(p),historical),path)
 const changed=JSON.parse(current('apps/srm/assistant-context-integration.json').toString());changed.acquisitionAllowed=true
 assert.throws(()=>srmAssistantM2Predecessor((p:string)=>p==='apps/srm/assistant-context-integration.json'?Buffer.from(JSON.stringify(changed)):current(p),historical))
})

function row():ReportReadRow{
 const facts:ReportReadRow['facts']=['PALA_NRFS','PALA_NPL'].map(metricCode=>({metricCode,periodStart:'2025-01-01',periodEnd:'2025-12-31',statementScope:'UNIT',amount:'123456.789',
  sourceAmount:'123456.789',currencyCode:'PLN',unitCode:'PLN',sourcePath:'synthetic-source-path',validationStatus:'VALID',normalizationRule:'SOURCE_VALUE',sourceSnapshotId:'synthetic-snapshot'}))
 return {nip,financial_sha256:version,financial_checked_at:at,financial_json:{status:'SUCCESS',
  source:{provider:'MGBI',model:'synthetic',recordId:'synthetic'},retrievedAt:at.toISOString(),effectiveAt:'2025-12-31',warnings:[],catalogMappingVersion:FINANCIAL_MAPPING_VERSION,
  data:{qualityRule:'FINANCIAL_QUALITY_V1',periods:[{from:'2025-01-01',to:'2025-12-31',scope:'standalone',documentId:'synthetic-document',
   facts:facts.map(f=>({metricCode:f.metricCode,amount:f.amount,currency:'PLN',unit:'PLN'}))}]}},facts,indicators:[],kys:null}
}
const client={query:async(sql:string)=>{assert.match(sql,/^SELECT /);assert(!sql.includes('source_snapshots'));return {rows:[row()]}}} as unknown as PoolClient
const req=(suffix='',headers={})=>new Request('https://srm-development-runtime.onrender.com/api/xray/assistant-context?nip='+nip+'&year=2025&comparisonYear=2024'+suffix,
 {headers:{authorization:'Bearer synthetic-session',...headers}})
test('bounded financial projection preserves the native year, scope, currency and value; no browser facts or persons',async()=>{
 const financial=await readSharedFinancialReport(client,org,{nip,entityType:'COMPANY'},version)
 const projected=projectSupplierAssistantSummary({selection,financial,kys:{status:'DENIED'}})
 assert.equal(projected.financial.selectedYear,2025);assert.equal(projected.financial.periods[0].statementScope,'standalone')
 assert.equal(projected.financial.periods[0].facts[0].amount,'123456.789');assert.equal(projected.financial.periods[0].facts[0].currency,'PLN')
 assert.equal(projected.kys.status,'DENIED');assert.equal(projected.kys.riskLevel,null);assert.equal(projected.status,'PARTIAL')
 assert.equal(projectSupplierAssistantSummary({selection:{...selection,statementScope:'consolidated'},financial,kys:{status:'DENIED'}}).financial.periods.length,0)
 assert.throws(()=>readSupplierAssistantSelection({...selection,financialSummary:{revenue:999}}))
})
test('native stored financial read and private KYS are separate, current producer operations; personal fields never leave the projection',async()=>{
 let financialReads=0,kysReads=0
 const executor={execute:async(input:any,action:any)=>{financialReads++;assert.equal(input.operation,'supplier.report.read');assert.equal(input.organisationId,org)
  assert.equal(input.resourceId,'supplier-report:COMPANY:'+nip)
  const context={operation:input.operation,payload:input.payload,organisationId:org,resource:{version}} as OperationContext
  const value=await action(context,client)
  // Exercise the real native output boundary, rather than accepting whatever
  // the callback returned. Private KYS must never enter this shared DTO.
  const publication=await projectSharedFinancialResponse(value,context)
  assert.equal((await publication.clone().json()).kys.status,'NOT_REQUESTED')
  return {value:publication}}} as unknown as OperationExecutor<PoolClient>
 const api={readAcceptedKys:async(request:Request,organisationId:string,selectedNip:string,entityType?:'COMPANY'|'JDG')=>{kysReads++;assert.equal(organisationId,org);assert.equal(selectedNip,nip);assert.equal(entityType,'COMPANY')
  assert.equal(request.headers.get('authorization'),'Bearer synthetic-session')
  return Response.json({privateReport:{nip,entityType:'COMPANY',retentionUntil:new Date(Date.now()+60000).toISOString()},section:{status:'SUCCESS',retrievedAt:at.toISOString(),effectiveAt:null,warnings:[],
   data:{company:{name:'Synthetic company',nip,krs:'0000000001'},isComplete:true,stateAsOf:null,queriedRegisters:[],riskLevel:'SOURCE_LOW',
    relatedPersons:[{fullName:'PRIVATE_PERSON',pesel:'12345678901',peselRevealToken:'PRIVATE_TOKEN'}],screeningSummary:{directlyRelatedSanctions:false,beneficiaryRelatedSanctions:null,otherLists:false}}}})}}
 const handler=createSrmAssistantContextHandler({executor,defaultOrganisationId:org,api})
 const r=await handler(req()),body=await r.json(),text=JSON.stringify(body)
 assert.equal(r.status,200);assert.equal(financialReads,1);assert.equal(kysReads,1);assert.equal(body.kys.riskLevel,'SOURCE_LOW')
 for(const privateValue of ['PRIVATE_PERSON','12345678901','PRIVATE_TOKEN','snapshotId','exportRef'])assert(!text.includes(privateValue))
 assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('vary'),'Cookie, Authorization')
})
test('final ordinary financial refusal after KYS prevents all combined disclosure',async()=>{
 let kysReads=0
 const executor={execute:async(_input:unknown,action:any)=>{
  await action({organisationId:org,resource:{version}},client)
  throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
 }} as unknown as OperationExecutor<PoolClient>
 const r=await createSrmAssistantContextHandler({executor,defaultOrganisationId:org,api:{readAcceptedKys:async()=>{
  kysReads++;return Response.json({privateReport:{nip,entityType:'COMPANY',retentionUntil:new Date(Date.now()+60000).toISOString()},
   section:{status:'SUCCESS',retrievedAt:at.toISOString(),effectiveAt:null,warnings:[],data:{company:{nip,name:'PRIVATE_COMPANY'},riskLevel:'PRIVATE_RISK'}}})
 }}})(req())
 assert.equal(kysReads,1);assert.equal(r.status,403)
 assert.deepEqual(await r.json(),{error:'Operation unavailable'})
})
test('source refusal blocks its data; KYS refusal leaves only separately authorised public financials',async()=>{
 const denied={execute:async()=>{throw new OperationDenied('PERMISSION_DENIED')}} as unknown as OperationExecutor<PoolClient>
 let readKys=false
 assert.equal((await createSrmAssistantContextHandler({executor:denied,defaultOrganisationId:org,api:{readAcceptedKys:async()=>{readKys=true;throw Error()}}})(req())).status,403)
 assert.equal(readKys,false)
 const executor={execute:async(_input:unknown,action:(c:unknown,client:PoolClient)=>unknown)=>({value:await action({organisationId:org,resource:{version}},client)})} as unknown as OperationExecutor<PoolClient>
 const h=createSrmAssistantContextHandler({executor,defaultOrganisationId:org,api:{readAcceptedKys:async()=>{throw new OperationDenied('PERMISSION_DENIED')}}})
 const r=await h(req()),body=await r.json();assert.equal(r.status,200);assert.equal(body.kys.status,'DENIED');assert.equal(body.kys.riskLevel,null)
 assert.equal(body.financial.periods[0].year,'2025')
 assert.equal((await h(req('&actorId=foreign'))).status,400);assert.equal((await h(req('',{cookie:'old-user'}))).status,401)
})
