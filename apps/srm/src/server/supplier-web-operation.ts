import {OperationDenied,type OperationContext,type Resource} from '@profitia/platform-contracts/operation-context'
import {createSrmPrivateOperationHost} from './private-operation-host'
import {readSupplierRequest} from './supplier-request-operation'
import {publicUrl,isPublicAddress} from './safe-public-fetch'
import {isIP} from 'node:net'
import type {PoolClient} from 'pg'
import type {SupplierWebIdentityData} from '@profitia/srm-xray'

type DriverOptions=Parameters<typeof createSrmPrivateOperationHost>[0]
export type WebReadOptions=Omit<DriverOptions,'readResources'|'projectOutput'|'prepareInputs'|'describeOutcome'|'requestLedger'>&{webBoundaryDigest:string}
const refuse=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
export function privateWebResourceId(nip:string,entityType:'COMPANY'|'JDG'){
 readSupplierRequest({kind:'SUPPLIER_REPORT',nip});if(!['COMPANY','JDG'].includes(entityType))return refuse()
 return `supplier-private-web:${entityType}:${nip}`
}
export function readPrivateWebSelection(value:unknown):Readonly<{nip:string;entityType:'COMPANY'|'JDG'}>{
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==2
  ||Object.keys(value).sort().join(',')!=='entityType,nip'
  ||Object.values(Object.getOwnPropertyDescriptors(value)).some(d=>!('value'in d)||!d.enumerable))return refuse()
 const v=value as Record<string,unknown>
 if(typeof v.nip!=='string'||!['COMPANY','JDG'].includes(v.entityType as string))return refuse()
 readSupplierRequest({kind:'SUPPLIER_REPORT',nip:v.nip});return Object.freeze({nip:v.nip,entityType:v.entityType as 'COMPANY'|'JDG'})
}
export function createSrmWebOperationHost(options:WebReadOptions){
 if(typeof window!=='undefined'||!/^[a-f0-9]{64}$/.test(options.webBoundaryDigest)
  ||options.application.operations.length!==1||options.application.operations[0]!=='supplier.private.read')throw TypeError('Explicit private website reader required')
 const digest=options.webBoundaryDigest
 return createSrmPrivateOperationHost({...options,readResources:async({actor,request,scope,query})=>{
  if(actor.kind!=='HUMAN'||!scope.organisationId||scope.userId!==actor.actorId)return refuse()
  const selected=readPrivateWebSelection(request.payload)
  if(request.operation!=='supplier.private.read'||request.resourceId!==privateWebResourceId(selected.nip,selected.entityType))return refuse()
  const d=(await query('SELECT srm.web_installation_descriptor() AS descriptor')).rows[0]?.descriptor as Record<string,unknown>|undefined
  if(!d||d.webSchemaVersion!=='1.0.0'||d.webBoundaryDigest!==digest)throw new OperationDenied('POLICY_UNAVAILABLE')
  await query("SELECT set_config('srm.organization_id',$1,true)",[scope.organisationId])
  const m=(await query('SELECT srm.private_web_metadata($1::uuid,$2,$3) AS metadata',[scope.organisationId,selected.nip,selected.entityType])).rows[0]?.metadata as Record<string,unknown>|undefined
  if(!m||m.ownerOrganisationId!==scope.organisationId||m.nip!==selected.nip||m.entityType!==selected.entityType
   ||typeof m.snapshotId!=='string'||!uuid.test(m.snapshotId)||typeof m.retentionUntil!=='string'
   ||!Number.isFinite(Date.parse(m.retentionUntil))||Date.parse(m.retentionUntil)<=Date.now())return refuse()
  const resource:Resource={id:request.resourceId,type:'supplier_private_report',dataClass:'ORGANISATION_PRIVATE',environment:scope.environment,
   ownerOrganisationId:scope.organisationId,ownerUserId:null,version:m.snapshotId,projectionVersion:'srm-private-website-v1',
   privateSupplier:{nip:selected.nip,entityType:selected.entityType,snapshotId:m.snapshotId,retentionUntil:new Date(m.retentionUntil).toISOString()}}
  return {resource}
 },projectOutput:projectPrivateWebOutput})
}
export function readWebIdentityProjection(value:unknown):SupplierWebIdentityData{
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==7
  ||Object.keys(value).sort().join(',')!=='checkedAt,evidenceUrl,logoDataUrl,logoSourceUrl,method,status,websiteUrl'
  ||Object.values(Object.getOwnPropertyDescriptors(value)).some(d=>!('value'in d)||!d.enumerable))return refuse()
 const v=value as SupplierWebIdentityData
 if(!['FOUND','NOT_FOUND','UNAVAILABLE'].includes(v.status)||typeof v.checkedAt!=='string'||!Number.isFinite(Date.parse(v.checkedAt))||Date.parse(v.checkedAt)>Date.now())return refuse()
 for(const key of['websiteUrl','evidenceUrl','logoSourceUrl'] as const)if(v[key]!==null){
  if(typeof v[key]!=='string'||v[key].length>4096)return refuse()
  const url=publicUrl(v[key]),host=url.hostname.replace(/^\[|\]$/g,'')
  if(url.href!==v[key]||isIP(host)&&!isPublicAddress(host))return refuse()
 }
 if(v.logoDataUrl!==null&&(typeof v.logoDataUrl!=='string'||v.logoDataUrl.length>200030||!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(v.logoDataUrl)))return refuse()
 if(v.method!==null&&!['REGISTRY_AND_WEBSITE','WEBSITE_IDENTITY'].includes(v.method))return refuse()
 if(v.status==='FOUND'?(!v.websiteUrl||!v.evidenceUrl||!v.method):[v.websiteUrl,v.evidenceUrl,v.logoSourceUrl,v.logoDataUrl,v.method].some(x=>x!==null))return refuse()
 return structuredClone(v)
}
export async function readPrivateWeb(context:Readonly<OperationContext>,client:PoolClient){
 const d=context.resource.privateSupplier,selected=readPrivateWebSelection(context.payload)
 if(context.operation!=='supplier.private.read'||context.actorKind!=='HUMAN'||context.subjectUserId!==context.actorId||!context.organisationId||!d
  ||context.resource.ownerOrganisationId!==context.organisationId||context.resource.ownerUserId!==null
  ||context.resource.id!==privateWebResourceId(selected.nip,selected.entityType)||d.nip!==selected.nip||d.entityType!==selected.entityType
  ||context.resource.version!==d.snapshotId)return refuse()
 const rows=await client.query('SELECT result_json,expires_at FROM srm.supplier_web_identity WHERE organization_id=$1::uuid AND nip=$2 AND entity_type=$3 AND result_version=$4::uuid AND expires_at>clock_timestamp()',
  [context.organisationId,selected.nip,selected.entityType,d.snapshotId])
 if(rows.rows.length!==1||new Date(rows.rows[0].expires_at).toISOString()!==new Date(d.retentionUntil).toISOString())return refuse()
 return Object.freeze({snapshotId:d.snapshotId,data:readWebIdentityProjection(rows.rows[0].result_json)})
}
export function projectPrivateWebOutput(value:unknown,context:Readonly<OperationContext>):Response{
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join(',')!=='data,snapshotId')return refuse()
 const v=value as {snapshotId:string;data:unknown},d=context.resource.privateSupplier
 if(!d||v.snapshotId!==d.snapshotId||context.operation!=='supplier.private.read'||context.resource.version!==d.snapshotId
  ||context.resource.ownerOrganisationId!==context.organisationId||Date.parse(d.retentionUntil)<=Date.now())return refuse()
 return Response.json(readWebIdentityProjection(v.data),{headers})
}
