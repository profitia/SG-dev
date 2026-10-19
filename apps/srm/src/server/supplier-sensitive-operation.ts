import {createHmac} from 'node:crypto'
import type {PoolClient} from 'pg'
import {OperationDenied,type OperationId,type OperationContext,type Resource} from '@profitia/platform-contracts/operation-context'
import {jdgDeregistration,kysPdfDocument,type JdgField,type JdgRegistryData,type SectionEnvelope,type VerclyKysData} from '@profitia/srm-xray'
import {createSrmPrivateOperationHost} from './private-operation-host'
import {bindOrganizationTransaction,withOrganization} from './db'
import {readSupplierRequest} from './supplier-request-operation'
import {toPublicSection} from './xray-lookup'
import {toPublicKysSection,issuePeselToken,verifyPeselToken} from './pesel-reveal'
import {readKysPersonPesel} from './xray-repository'
import {kysCacheTtlMs} from './kys-cache'
import {kysExportRef,authorizeStoredKys,readStoredKysPdf,KysPdfError} from './kys-pdf-access'
import {validateKysPdfSelection,renderKysPdf} from './kys-pdf'
import {readSupplierRegistrationStatus} from './company-activity'

export const SENSITIVE_SUPPLIER_PROJECTION='srm-sensitive-supplier-v1'
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const refuse=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
const privateHeaders={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}
type Entity='COMPANY'|'JDG'
type PrivateRead=Readonly<{nip:string;entityType:Entity;section:'kys'|'jdg'}>
type Metadata=Readonly<{snapshotId:string;ownerOrganisationId:string;nip:string;entityType:Entity;section:'kys'|'jdg';
 dataClass:'KYS_PERSONAL'|'JDG_REGISTRY';retrievedAt:string;retentionUntil:string;projectionVersion:number;sourceRecordId:string|null}>
function closed(value:unknown,keys:readonly string[]):value is Record<string,unknown>{
 return !!value&&Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(value).length===keys.length
  &&Object.keys(value).sort().join(',')===[...keys].sort().join(',')
  &&Object.values(Object.getOwnPropertyDescriptors(value)).every(d=>'value'in d&&d.enumerable)
}
export function readPrivateSupplierSelection(value:unknown):PrivateRead{
 if(!closed(value,['nip','entityType','section'])||!['COMPANY','JDG'].includes(String(value.entityType))
  ||!['kys','jdg'].includes(String(value.section))||value.section==='jdg'&&value.entityType!=='JDG')return refuse()
 return Object.freeze({nip:readSupplierRequest({kind:'SUPPLIER_REPORT',nip:value.nip as string}).nip,entityType:value.entityType as Entity,section:value.section as 'kys'|'jdg'})
}
export function privateSupplierReportId(value:PrivateRead):string{return `supplier-private-report:${value.section}:${value.entityType}:${value.nip}`}
export function privateSupplierExportId(nip:string,entityType:Entity):string{return `supplier-private-export:kys:${entityType}:${nip}`}
/** This uses internal account IDs, independently of the temporary IdP. A token
 * is only a reference; current read+reveal rights are checked by the executor. */
export function sensitiveActorSecret(secret:string,organisationId:string,userId:string):string{
 if(typeof secret!=='string'||secret.length<32||!uuid.test(organisationId)||!uuid.test(userId))return refuse()
 return createHmac('sha256',secret).update(JSON.stringify(['srm-sensitive-reference-v1','srm',organisationId,userId])).digest('hex')
}
function effectiveMetadata(input:unknown,organisationId:string):Metadata{
 if(!input||typeof input!=='object'||Array.isArray(input))return refuse()
 const m=input as Metadata
 if(!uuid.test(m.snapshotId)||m.ownerOrganisationId!==organisationId||!['COMPANY','JDG'].includes(m.entityType)
  ||!['kys','jdg'].includes(m.section)||m.section==='jdg'&&m.entityType!=='JDG'
  ||m.dataClass!==(m.section==='kys'?'KYS_PERSONAL':'JDG_REGISTRY')||m.projectionVersion!==(m.section==='kys'?2:1))return refuse()
 readSupplierRequest({kind:'SUPPLIER_REPORT',nip:m.nip})
 const retrieved=Date.parse(m.retrievedAt),until=Date.parse(m.retentionUntil)
 if(!Number.isFinite(retrieved)||!Number.isFinite(until)||until<=retrieved||retrieved>Date.now())return refuse()
 const maximum=m.section==='kys'?kysCacheTtlMs():30*24*60*60*1000
 return Object.freeze({...m,retrievedAt:new Date(retrieved).toISOString(),retentionUntil:new Date(Math.min(until,retrieved+maximum)).toISOString()})
}
function reportResource(m:Metadata,environment:'development'|'staging'|'production'):Resource{
 return {id:privateSupplierReportId(m),type:'supplier_private_report',environment,dataClass:'ORGANISATION_PRIVATE',ownerOrganisationId:m.ownerOrganisationId,
  ownerUserId:null,version:m.snapshotId,projectionVersion:SENSITIVE_SUPPLIER_PROJECTION,
  privateSupplier:{nip:m.nip,entityType:m.entityType,snapshotId:m.snapshotId,retentionUntil:m.retentionUntil}}
}
type DriverOptions=Parameters<typeof createSrmPrivateOperationHost>[0]
export function createSrmSensitiveOperationHost(options:Omit<DriverOptions,'readResources'|'projectOutput'|'prepareInputs'|'describeOutcome'>&{sensitiveBoundaryDigest:string;secret:string}){
 if(!/^[a-f0-9]{64}$/.test(options.sensitiveBoundaryDigest)||typeof options.secret!=='string'||options.secret.length<32
  ||options.application.operations.length!==3||!(['supplier.private.read','supplier.private.reveal','supplier.private.export'] as OperationId[]).every(v=>options.application.operations.includes(v)))throw TypeError('Explicit three-operation sensitive host required')
 const digest=options.sensitiveBoundaryDigest,secret=options.secret
 return createSrmPrivateOperationHost({...options,
  readResources:async({actor,request,scope,query})=>{
   if(actor.kind!=='HUMAN'||!scope.organisationId||scope.userId!==actor.actorId)return refuse()
   const descriptor=(await query('SELECT srm.sensitive_installation_descriptor() AS descriptor')).rows[0]?.descriptor as Record<string,unknown>|undefined
   if(!descriptor||descriptor.sensitiveSchemaVersion!=='1.0.0'||descriptor.sensitiveBoundaryDigest!==digest
    ||!uuid.test(scope.organisationId)||typeof descriptor.sensitiveSourceRef!=='string'||!/^[a-f0-9]{40}$/.test(descriptor.sensitiveSourceRef))throw new OperationDenied('POLICY_UNAVAILABLE')
   await query("SELECT set_config('srm.organization_id',$1,true)",[scope.organisationId])
   let selected:PrivateRead|undefined,snapshot:string|null=null
   if(request.operation==='supplier.private.reveal'){
    if(request.resourceId!=='supplier-private-identifier'||!closed(request.payload,['token']))return refuse()
    const reference=verifyPeselToken(sensitiveActorSecret(secret,scope.organisationId,scope.userId),request.payload.token)
    if(!reference)return refuse();snapshot=reference.snapshotId
   }else if(request.operation==='supplier.private.export'){
    const value=validateKysPdfSelection(request.payload);selected={nip:value.nip,entityType:value.entityType,section:'kys'}
    if(request.resourceId!==privateSupplierExportId(selected.nip,selected.entityType))return refuse()
   }else{
    selected=readPrivateSupplierSelection(request.payload)
    if(request.resourceId!==privateSupplierReportId(selected))return refuse()
   }
   const row=(await query('SELECT srm.private_supplier_metadata($1::uuid,$2,$3,$4,$5::uuid) AS metadata',
    [scope.organisationId,selected?.nip??null,selected?.entityType??null,selected?.section??'kys',snapshot])).rows[0]?.metadata
   const m=effectiveMetadata(row,scope.organisationId),report=reportResource(m,scope.environment)
   if(request.operation==='supplier.private.read')return {resource:report}
   return {resource:{...report,id:request.resourceId,type:request.operation==='supplier.private.reveal'?'supplier_private_identifier':'supplier_private_export'},inputs:[report]}
  },projectOutput:(value,context)=>projectSensitiveSupplierOutput(value,context,secret),
 })
}
function bound(context:Readonly<OperationContext>){
 const d=context.resource.privateSupplier
 if(context.actorKind!=='HUMAN'||context.subjectUserId!==context.actorId||!context.organisationId
  ||context.resource.dataClass!=='ORGANISATION_PRIVATE'||context.resource.ownerOrganisationId!==context.organisationId
  ||context.resource.ownerUserId!==null||!d||context.resource.version!==d.snapshotId||!uuid.test(d.snapshotId)
  ||!['COMPANY','JDG'].includes(d.entityType)||!Number.isFinite(Date.parse(d.retentionUntil))
  ||Date.parse(d.retentionUntil)<=Date.now())return refuse()
 readSupplierRequest({kind:'SUPPLIER_REPORT',nip:d.nip})
 return d
}
function redactJdg(data:JdgRegistryData):JdgRegistryData{
 const fields=(items:readonly JdgField[]):JdgField[]=>items.map(item=>{
  const privateKey=/pesel|personal.?identifier|national.?id|numer.?dowodu|passport.?number/i.test(item.key)
  return {...item,value:privateKey?null:item.value,children:privateKey?[]:fields(item.children)}
 })
 return {...data,entries:data.entries.map(entry=>({...entry,fields:fields(entry.fields)}))}
}
type ReadValue={kind:'READ';snapshotId:string;nip:string;entityType:Entity;section:'jdg'|'kys';envelope:SectionEnvelope<JdgRegistryData|VerclyKysData>;exportRef:string|null}
type RevealValue={kind:'REVEAL';snapshotId:string;pesel:string|null}
type ExportValue={kind:'EXPORT';snapshotId:string;response:Response}
export async function projectSensitiveSupplierOutput(value:unknown,context:Readonly<OperationContext>,secret:string):Promise<Response>{
 const d=bound(context)
 if(!value||typeof value!=='object'||Array.isArray(value))return refuse()
 const v=value as ReadValue|RevealValue|ExportValue
 if(v.snapshotId!==d.snapshotId)return refuse()
 if(context.operation==='supplier.private.reveal'){
  if(!closed(v,['kind','snapshotId','pesel'])||v.kind!=='REVEAL'||v.pesel!==null&&!/^[0-9]{11}$/.test(v.pesel))return refuse()
  return v.pesel===null?Response.json({error:'Numer nie jest dostępny.'},{status:404,headers:privateHeaders}):Response.json({pesel:v.pesel},{headers:privateHeaders})
 }
 if(context.operation==='supplier.private.export'){
  if(!closed(v,['kind','snapshotId','response'])||v.kind!=='EXPORT'||!(v.response instanceof Response)
   ||v.response.headers.get('Cache-Control')!==privateHeaders['Cache-Control']||v.response.headers.get('Vary')!==privateHeaders.Vary)return refuse()
  if(v.response.status!==200||v.response.headers.get('content-type')!=='application/pdf')return refuse()
  const filename=v.response.headers.get('X-Download-Filename')
  if(!filename||!/^KYS_[0-9]{10}_[0-9]{4}-[0-9]{2}-[0-9]{2}\.pdf$/.test(filename)||!filename.startsWith(`KYS_${d.nip}_`)
   ||v.response.headers.get('Content-Disposition')!==`attachment; filename="${filename}"`)return refuse()
  const bytes=new Uint8Array(await v.response.clone().arrayBuffer())
  if(bytes.length<5||bytes.length>24*1024*1024||String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')return refuse()
  return v.response
 }
 if(context.operation!=='supplier.private.read'||!closed(v,['kind','snapshotId','nip','entityType','section','envelope','exportRef'])
  ||v.kind!=='READ'||v.nip!==d.nip||v.entityType!==d.entityType||!['kys','jdg'].includes(v.section)
  ||v.envelope.source.provider!==(v.section==='kys'?'VERCLY':'CEIDG')||Date.parse(v.envelope.retrievedAt??'')>Date.now())return refuse()
 let projected
 if(v.section==='kys'){
  const envelope=v.envelope as SectionEnvelope<VerclyKysData>,safe=toPublicKysSection(envelope,null,'')
  const key=sensitiveActorSecret(secret,context.organisationId!,context.actorId)
  const people=(list:'relatedPersons'|'beneficialOwners')=>safe.data?.[list]?.map((person,index)=>({...person,
   peselRevealToken:/^[0-9]{11}$/.test(envelope.data?.[list]?.[index]?.pesel??'')?issuePeselToken(key,{snapshotId:d.snapshotId,list,index},Date.parse(d.retentionUntil)):null}))
  projected=safe.data?{...safe,data:{...safe.data,relatedPersons:people('relatedPersons'),beneficialOwners:people('beneficialOwners')}}:safe
 }else{
  const envelope=v.envelope as SectionEnvelope<JdgRegistryData>
  projected=toPublicSection({...envelope,data:envelope.data?redactJdg(envelope.data):null})
 }
 return Response.json({section:projected,privateReport:{snapshotId:d.snapshotId,nip:d.nip,entityType:d.entityType,retentionUntil:d.retentionUntil,exportRef:v.exportRef}}, {headers:privateHeaders})
}

/** Existing stored data only. Called inside the common admitted transaction. */
export async function readPrivateSupplier(context:Readonly<OperationContext>,client:PoolClient,secret:string):Promise<ReadValue>{
 const d=bound(context)
 const row=(await client.query<{section:'jdg'|'kys';envelope:ReadValue['envelope'];retrievedAt:string;retentionUntil:string;dataClass:string;projectionVersion:number;projectionHash:string}>(
  `SELECT v.section,p.private_envelope AS envelope,v.retrieved_at::text AS "retrievedAt",v.retention_until::text AS "retentionUntil",v.data_class AS "dataClass",p.projection_version AS "projectionVersion",
   md5(p.data_json::text||COALESCE((p.private_envelope->'warnings')::text,'[]')) AS "projectionHash"
   FROM srm.source_snapshots v JOIN srm.section_projections p ON p.organization_id=v.organization_id AND p.snapshot_id=v.id AND p.supplier_id=v.supplier_id AND p.section=v.section
   WHERE v.organization_id=$1::uuid AND v.id=$2::uuid ORDER BY p.projection_version DESC LIMIT 1`,[context.organisationId,d.snapshotId])).rows[0]
 if(!row?.envelope||row.envelope.data===null||!['kys','jdg'].includes(row.section))return refuse()
 const key=sensitiveActorSecret(secret,context.organisationId!,context.actorId)
 const exportRef=row.section==='kys'?kysExportRef(context.organisationId!,d,{snapshotId:d.snapshotId,projectionVersion:row.projectionVersion,
  projectionHash:row.projectionHash,dataClass:row.dataClass,retrievedAt:row.retrievedAt,retentionUntil:row.retentionUntil},key):null
 return {kind:'READ',snapshotId:d.snapshotId,nip:d.nip,entityType:d.entityType,section:row.section,envelope:row.envelope,exportRef}
}
export async function revealPrivateSupplier(context:Readonly<OperationContext>,client:PoolClient,secret:string):Promise<RevealValue>{
 const d=bound(context)
 if(context.operation!=='supplier.private.reveal'||!closed(context.payload,['token']))return refuse()
 const reference=verifyPeselToken(sensitiveActorSecret(secret,context.organisationId!,context.actorId),context.payload.token)
 if(!reference||reference.snapshotId!==d.snapshotId)return refuse()
 const pesel=await readKysPersonPesel(context.organisationId!,reference.snapshotId,reference.list,reference.index,bindOrganizationTransaction(context.organisationId!,client))
 return {kind:'REVEAL',snapshotId:d.snapshotId,pesel}
}
export async function exportPrivateKys(context:Readonly<OperationContext>,client:PoolClient,secret:string,render=renderKysPdf):Promise<ExportValue>{
 const d=bound(context);if(context.operation!=='supplier.private.export')return refuse()
 const selected=validateKysPdfSelection(context.payload),pool=bindOrganizationTransaction(context.organisationId!,client)
 const readStatus:typeof readSupplierRegistrationStatus=async(org,nip,entity,boundPool)=>{
  if(org!==context.organisationId||nip!==d.nip||entity!==d.entityType||boundPool!==pool)return refuse()
  if(entity==='COMPANY')return readSupplierRegistrationStatus(org,nip,entity,pool)
  return withOrganization(org,async c=>{const data=(await c.query<{data:JdgRegistryData|null}>('SELECT srm.private_jdg_activity_metadata($1::uuid,$2) AS data',[org,nip])).rows[0]?.data
   return jdgDeregistration(data).deregistered?'DEREGISTERED':'UNKNOWN'},pool)
 }
 const env={...process.env,SRM_DEMO_SESSION_SECRET:sensitiveActorSecret(secret,context.organisationId!,context.actorId)}
 const read=()=>readStoredKysPdf(context.organisationId!,selected,pool,{snapshotId:d.snapshotId,readRegistrationStatus:readStatus})
 const now=new Date(),authorized=authorizeStoredKys(await read(),context.organisationId!,selected,now,env)
 const document=kysPdfDocument(authorized.row.data,{...selected,retrievedAt:new Date(authorized.row.retrievedAt!).toISOString(),generatedAt:now.toISOString(),
  expiresAt:authorized.expiresAt,partial:authorized.row.data.isComplete!==true||!authorized.row.completionConfirmed,warnings:authorized.row.warnings})
 const bytes=await render(document)
 authorizeStoredKys(await read(),context.organisationId!,selected,new Date(),env)
 const filename=`KYS_${d.nip}_${now.toISOString().slice(0,10)}.pdf`
 return {kind:'EXPORT',snapshotId:d.snapshotId,response:new Response(new Uint8Array(bytes),{headers:{...privateHeaders,'Content-Type':'application/pdf',
  'Content-Disposition':`attachment; filename="${filename}"`,'X-Download-Filename':filename}})}
}
