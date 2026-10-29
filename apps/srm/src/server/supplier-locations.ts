import type {PoolClient} from 'pg'
import {createHash} from 'node:crypto'
import {OPERATION_CONTRACT,OperationDenied,isOperationDenied,type Json,type OperationId} from '@profitia/platform-contracts/operation-context'
import {validRequestIdempotencyKey} from '@profitia/platform-contracts/request-ledger'
import {readPresentationJson} from '@profitia/platform-contracts/embedded-read-channel'
import {parseManualLocation,type LocationSource,type SupplierLocationGroup} from '@profitia/srm-xray'
import {createSrmPrivateOperationHost,resolveSrmPrivateIdentity} from './private-operation-host'
import {createSupplierLocationAdmission} from '@profitia/platform-contracts/supplier-location'
import {isSameOriginRequest} from './request-origin'
import {locationCollectionId,locationCommandDigest,assignedLocationId,manualAddressVersion,readLocationPage,writeManualLocation,reconcileLocations,locationSourceEvidence,type LocationPayload} from './supplier-location-store'
import {projectSupplierHeadquarters,projectRelatedCompanyLocations,sourceAddressVersion,sourceSyncIdentity,type LocationProjection,type AcceptedCompanyAddress} from './supplier-location-sync'
import {readLocationCompany,acceptedKysLocations,type AcceptedKysLocations} from './supplier-location-source'

type DriverOptions=Parameters<typeof createSrmPrivateOperationHost>[0]
export type SupplierLocationRuntimeOptions=Omit<DriverOptions,'readResources'|'projectOutput'|'prepareInputs'|'describeOutcome'|'requestLedger'>&{
 sourceScope?:'HEADQUARTERS_MANUAL';
 businessDigest:string;parentSchemaDigest?:string;ledger:NonNullable<DriverOptions['requestLedger']>;
 readAcceptedKys?:(request:Request,org:string,nip:string)=>Promise<Response>
 prepareAccess?:(request:Request,organisationId:string,supplierId:string,locationId?:string|null)=>Promise<void>
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const groups=['ALL','SUPPLIER_LOCATIONS','RELATED_ENTITIES','USER_LOCATIONS']
const refuse=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
const closed=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===[...keys].sort().join(',')
const payload=(supplierId:string):LocationPayload=>({action:'READ',supplierId,locationId:null,addressVersion:null,expectedVersion:null,command:null})
export function createSupplierLocationHost(options:SupplierLocationRuntimeOptions,operation:'supplier.location.read'|'supplier.location.write'|'supplier.location.sync',sources:readonly ReturnType<typeof locationSourceEvidence>[]=[]){
 const {businessDigest,parentSchemaDigest,locationAdmission,ledger,readAcceptedKys:__,sourceScope,...driver}=options
 if(sourceScope==='HEADQUARTERS_MANUAL'&&sources.some(v=>v.kind!=='MGBI'))return refuse()
 if(!/^[a-f0-9]{64}$/.test(businessDigest)||sources.length>64)throw TypeError('Exact SRM location boundary required')
 if(locationAdmission&&!/^[a-f0-9]{64}$/.test(parentSchemaDigest??''))throw TypeError('Exact P1 receiver digest required')
 return createSrmPrivateOperationHost({...driver,
  application:{...driver.application,operations:[operation,'supplier.report.read','supplier.private.read'] as OperationId[]},
  ...(operation==='supplier.location.read'?{}:{requestLedger:ledger,...(locationAdmission?{locationAdmission}:{})}),
  readResources:async({actor,scope,request,query})=>{
   const p=request.payload as unknown as LocationPayload
   if(actor.kind!=='HUMAN'||scope.userId!==actor.actorId||!scope.organisationId||!p||!uuid.test(p.supplierId)
    ||request.operation!==operation||request.resourceId!==(operation==='supplier.location.write'?p.locationId:locationCollectionId(p.supplierId)))return refuse()
   const descriptor=(await query('SELECT srm.location_installation_descriptor() AS value')).rows[0]?.value
   if(!descriptor||typeof descriptor!=='object'||(descriptor as Record<string,unknown>).locationBusinessSchemaDigest!==businessDigest)throw new OperationDenied('POLICY_UNAVAILABLE')
   await query("SELECT set_config('srm.organization_id',$1,true)",[scope.organisationId])
   if(locationAdmission&&operation!=='supplier.location.read'){
    const parentDescriptor=(await query('SELECT srm.location_admission_installation_descriptor() AS value')).rows[0]?.value as {parentSchemaDigest?:string}|undefined
    if(parentDescriptor?.parentSchemaDigest!==parentSchemaDigest)throw new OperationDenied('POLICY_UNAVAILABLE')
   }
   const row=(await query(locationAdmission&&operation!=='supplier.location.read'
    ?'SELECT srm.location_admission_metadata($1::uuid,$2::uuid,$3,$5,$4::uuid) AS value'
    :'SELECT srm.location_metadata($1::uuid,$2::uuid,$3,$4::uuid) AS value',
    [scope.organisationId,p.supplierId,operation,p.locationId,...(locationAdmission&&operation!=='supplier.location.read'?[p.action]:[])])).rows[0]?.value as {collectionVersion:string;exists:boolean;origin:string|null;version:string|null;addressVersion:string|null}|undefined
   if(!row)throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
   const write=operation==='supplier.location.write',sync=operation==='supplier.location.sync'
   if(sync){
    const current=sources.map(v=>({kind:v.kind,reportId:v.kind==='KYS'?v.resource.version:'MGBI:'+v.resource.id.split(':')[2]+':'+v.resource.version,version:v.resource.version,retentionUntil:v.retentionUntil}))
    if((await query('SELECT srm.location_sources_admitted($1::uuid,$2::uuid,$3::jsonb) AS value',[scope.organisationId,p.supplierId,JSON.stringify(current)])).rows[0]?.value!==true)throw new OperationDenied('RESOURCE_VERSION_CONFLICT')
   }
   if(write&&row.exists&&row.origin!=='MANUAL')return refuse()
   return {resource:{id:request.resourceId!,type:write?'supplier_location':sync?'supplier_location_sync_request':'supplier_location_collection',
    dataClass:sync?'OPERATION_AUDIT':'ORGANISATION_PRIVATE',environment:scope.environment,ownerOrganisationId:scope.organisationId,
    ownerUserId:sync?actor.actorId:null,version:write?row.version??'0':row.collectionVersion,projectionVersion:'srm-supplier-locations-v1',
    supplierLocation:{supplierId:p.supplierId,locationId:p.locationId,group:write?'USER_LOCATIONS':'ALL',origin:write?'MANUAL':'COLLECTION',
     addressVersion:p.addressVersion,targetVersion:write?row.version??'0':row.collectionVersion,exists:write?row.exists:true,serverAssignedId:write&&p.action==='CREATE',
     commandDigest:locationCommandDigest(p.command),executorApplicationId:null,sources:[...sources]}}}
  },projectOutput:value=>value,
 })
}
type Input={request:Request;organisationId:string;supplierId:string}
export function createSupplierLocationRuntime(options:SupplierLocationRuntimeOptions){
 const admission=options.locationAdmission?createSupplierLocationAdmission({...options.locationAdmission,binding:options.binding}):null
 const reader=createSupplierLocationHost(options,'supplier.location.read'),writer=createSupplierLocationHost(options,'supplier.location.write')
 const execute=<T>(host:typeof reader,input:Input,p:LocationPayload,run:Parameters<typeof reader.execute<T>>[1],key?:string)=>
  host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:p.action==='READ'?'supplier.location.read':p.action==='SYNC'?'supplier.location.sync':'supplier.location.write',
   organisationId:input.organisationId,resourceId:p.locationId??locationCollectionId(input.supplierId),payload:p as unknown as Json,request:input.request,...(key?{idempotencyKey:key}:{})},run)
 const read=async<T>(input:Input,run:Parameters<typeof reader.execute<T>>[1])=>(await execute(reader,input,payload(input.supplierId),run)).value
 return Object.freeze({
  async page(input:Input,group:string,offset:number,limit:number){if(options.sourceScope==='HEADQUARTERS_MANUAL'&&!['SUPPLIER_LOCATIONS','USER_LOCATIONS'].includes(group))return refuse();await options.prepareAccess?.(input.request,input.organisationId,input.supplierId);return read(input,(context,client)=>readLocationPage(context,client,input.supplierId,group,offset,limit))},
  async write(input:Input,action:'CREATE'|'UPDATE'|'DEACTIVATE',locationId:string|null,expectedVersion:string|null,command:unknown,key:string){
   if(!validRequestIdempotencyKey(key))return refuse()
   const selected=action==='DEACTIVATE'?null:parseManualLocation(command)
   await options.prepareAccess?.(input.request,input.organisationId,input.supplierId)
   const identity=action==='CREATE'&&admission?await resolveSrmPrivateIdentity({...options,readResources:async()=>refuse(),projectOutput:v=>v},input.request,input.organisationId):null
   const id=action==='CREATE'?(admission&&identity&&identity.organisationId?admission.locationId({organisationId:identity.organisationId,userId:identity.actor.actorId,supplierId:input.supplierId,idempotencyKey:key})
    :assignedLocationId(input.organisationId,input.supplierId,'MANUAL:'+key)):locationId
   if(!id||!uuid.test(id)||action!=='CREATE'&&(!expectedVersion||!/^\d{1,18}$/.test(expectedVersion)))return refuse()
   const p:LocationPayload={action,supplierId:input.supplierId,locationId:id,expectedVersion:action==='CREATE'?null:expectedVersion,
    addressVersion:selected?manualAddressVersion(selected):locationCommandDigest(['deactivated',id,expectedVersion]),command:selected as unknown as Json}
   return (await execute(writer,input,p,(context,client)=>writeManualLocation(context,client,p),key)).value
  },
  async sync(input:Input){
   await options.prepareAccess?.(input.request,input.organisationId,input.supplierId)
   const selected=await read(input,async(_context,client)=>{
    const row=(await client.query('SELECT nip,krs FROM srm.suppliers WHERE organization_id=$1 AND id=$2',[input.organisationId,input.supplierId])).rows[0]
    if(!row?.nip)return refuse()
    return {nip:row.nip as string,company:await readLocationCompany(client,input.organisationId,input.supplierId,row.nip)}
   })
   let kys:AcceptedKysLocations|null=null
   if(options.sourceScope!=='HEADQUARTERS_MANUAL'&&options.readAcceptedKys){
    // This existing protected read cannot acquire a provider report. A missing
    // private grant withholds related entities while HQ/manual data still work.
    try{const r=await options.readAcceptedKys(input.request,input.organisationId,selected.nip);if(r.ok)kys=acceptedKysLocations(await r.json(),selected.nip)}
    catch(e){if(!isOperationDenied(e))throw e}
   }
   const plans:{rows:LocationProjection[];sources:LocationSource[];addressProjection?:AcceptedCompanyAddress['addressProjection']}[]=[]
   if(selected.company){const h=projectSupplierHeadquarters(selected.company);if(h)plans.push({rows:[h],sources:[selected.company.source],addressProjection:selected.company.addressProjection})}
   if(kys){
    // First preserve every legally identified relationship, including those
    // without addresses. Enrichment uses only already stored corporate data.
    plans.push({rows:projectRelatedCompanyLocations({supplierId:input.supplierId,source:kys.source,entities:kys.entities,complete:true},[]),sources:[kys.source]})
    const relatedKrs=[...new Set(kys.entities.map(v=>v.krs).filter((v):v is string=>!!v&&/^[0-9]{10}$/.test(v)))]
    const matchedNips=await read(input,async(_context,client)=>(await client.query<{nip:string}>(`SELECT min(nip) AS nip FROM srm.catalog_companies
      WHERE general_json#>>'{data,krs}'=ANY($1::text[])
       AND profitia_requests.location_permission('srm',$2::uuid,nullif(current_setting('profitia.user_id',true),'')::uuid,'supplier.report.read','supplier-report:COMPANY:'||nip)
      GROUP BY general_json#>>'{data,krs}' HAVING count(*)=1`,[relatedKrs,input.organisationId])).rows.map(v=>v.nip))
    const nips=[...new Set([...kys.entities.map(v=>v.nip).filter((v):v is string=>!!v&&/^[0-9]{10}$/.test(v)),...matchedNips])]
    for(let offset=0;offset<nips.length;offset+=16){
     const batch=nips.slice(offset,offset+16),corporate=await read(input,async(_context,client)=>{
      const result=[];for(const nip of batch){const c=await readLocationCompany(client,input.organisationId,input.supplierId,nip);if(c)result.push(c)}return result
     })
     if(!corporate.length)continue
     const entities=kys.entities.filter(v=>corporate.some(c=>v.krs?c.krs===v.krs:c.nip===v.nip))
     const rows=projectRelatedCompanyLocations({supplierId:input.supplierId,source:kys.source,entities,complete:true},corporate)
     plans.push({rows,sources:[kys.source,...corporate.map(c=>c.source)],addressProjection:corporate.find(c=>c.addressProjection)?.addressProjection})
    }
   }
   const receipts=[]
   for(const plan of plans){
    const sources=[...new Map(plan.sources.map(v=>[v.kind+':'+v.reportId,v])).values()]
    const key=sourceSyncIdentity(input.organisationId,input.supplierId,sources,plan.addressProjection)
    const expectedVersion=await read(input,async(context,client)=>{
     const digest=createHash('sha256').update(JSON.stringify(['profitia.request-key@1','srm',context.environment,context.actorId,'supplier.location.sync',key])).digest('hex')
     return (await client.query('SELECT srm.location_sync_target($1::uuid,$2::uuid,$3) AS value',[input.organisationId,input.supplierId,digest])).rows[0].value as string
    })
    const evidence=sources.map(v=>locationSourceEvidence(v,input.organisationId,selected.nip)),host=createSupplierLocationHost(options,'supplier.location.sync',evidence)
    const p:LocationPayload={action:'SYNC',supplierId:input.supplierId,locationId:null,addressVersion:null,expectedVersion,command:{sources:evidence.map(v=>({id:v.resource.id,version:v.resource.version}))}}
    const rows=plan.rows.map(row=>({...row,id:assignedLocationId(input.organisationId,input.supplierId,row.entityKey),addressVersion:sourceAddressVersion(row)}))
    receipts.push((await execute(host,input,p,(context,client)=>reconcileLocations(context,client,p,rows),key)).value)
   }
   return {status:plans.length?'CURRENT':'NO_ACCEPTED_SOURCE',receipts,branches:'NOT_CONFIRMED' as const}
  },
 })
}
export type SupplierLocationRuntime=ReturnType<typeof createSupplierLocationRuntime>
const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}
export function createSupplierLocationHandler(runtime:SupplierLocationRuntime,defaultOrganisationId:string,geocoding?:Readonly<{resolve(input:Input&{locationId:string}):Promise<unknown>}>){
 return async(request:Request)=>{
  const fail=(status:number)=>Response.json({error:'Lokalizacje są teraz niedostępne.'},{status,headers})
  if(request.method!=='POST'){const r=fail(405);r.headers.set('Allow','POST');return r}
  if(!isSameOriginRequest(request))return fail(403)
  const query=new URL(request.url).searchParams,org=query.get('organisationId')??defaultOrganisationId
  if([...query.keys()].some(k=>k!=='organisationId')||query.getAll('organisationId').length>1||!uuid.test(org)
   ||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return fail(400)
  let body:unknown
  try{
   if(!request.body)return fail(400)
   const stream=request.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>(),{signal:AbortSignal.any([request.signal,AbortSignal.timeout(3000)])})
   body=await readPresentationJson(new Response(stream,{headers:{'content-type':'application/json'}}),16384)
  }catch{return fail(400)}
  try{
   if(!body||typeof body!=='object'||Array.isArray(body))return fail(400)
   const b=body as Record<string,unknown>
   if(!uuid.test(String(b.supplierId)))return fail(400)
   const input={request,organisationId:org,supplierId:b.supplierId as string}
   if(b.action==='READ'){
    if(!closed(b,['action','supplierId','group','offset','limit'])||!groups.includes(String(b.group))||!Number.isInteger(b.offset)||!Number.isInteger(b.limit)
     ||Number(b.offset)<0||Number(b.offset)>100000||Number(b.limit)<1||Number(b.limit)>100)return fail(400)
    const page=await runtime.page(input,b.group as SupplierLocationGroup,b.offset as number,b.limit as number)
    return Response.json({...page,...(geocoding?{geocodingAvailable:true}:{})},{headers})
   }
   if(b.action==='SYNC'){
    if(!closed(b,['action','supplierId']))return fail(400)
    return Response.json(await runtime.sync(input),{headers})
   }
   if(b.action==='GEOCODE'){
    if(!closed(b,['action','supplierId','locationId'])||!uuid.test(String(b.locationId)))return fail(400)
    if(!geocoding)return Response.json({status:'WAITING_OWNER',paidCalls:0},{headers})
    return Response.json(await geocoding.resolve({...input,locationId:b.locationId as string}),{headers})
   }
   if(!['CREATE','UPDATE','DEACTIVATE'].includes(String(b.action))||!closed(b,['action','supplierId','locationId','expectedVersion','command'])
    ||b.locationId!==null&&!uuid.test(String(b.locationId))||b.action==='CREATE'&&(b.locationId!==null||b.expectedVersion!==null)
    ||b.action==='DEACTIVATE'&&b.command!==null||!validRequestIdempotencyKey(request.headers.get('idempotency-key')))return fail(400)
   return Response.json(await runtime.write(input,b.action as 'CREATE'|'UPDATE'|'DEACTIVATE',b.locationId as string|null,b.expectedVersion as string|null,b.command,request.headers.get('idempotency-key')!),{status:202,headers})
  }catch(error){
   if(error instanceof TypeError)return fail(400)
   const reason=isOperationDenied(error)?error.reasonCode:null
   const sql=(error as {code?:string})?.code
   return fail(reason==='UNVERIFIED_IDENTITY'?401:reason==='RESOURCE_VERSION_CONFLICT'||reason==='IDEMPOTENCY_CONFLICT'||sql==='40001'?409
    :reason==='LIMIT_EXCEEDED'?429:reason&& !['POLICY_UNAVAILABLE','AUDIT_UNAVAILABLE','LIMIT_POLICY_UNAVAILABLE'].includes(reason)?403:503)
  }
 }
}
