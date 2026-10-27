import {completePostalAddress,displayPostalAddress,type SupplierLocation,type LocationCoordinates} from '@profitia/srm-xray'
/** Server-owned selection only. This never calls Google or grants permission;
 * the shared Root/Service/Source mechanisms must still admit the command. */
export function supplierGeocodingSelection(location:SupplierLocation){
 if(location.lifecycle!=='ACTIVE'||!completePostalAddress(location.address))return null
 return {supplierId:location.supplierId,locationId:location.id,address:displayPostalAddress(location.address),addressVersion:location.addressVersion,expectedVersion:location.version}
}
export function googleCoordinates(result:unknown,retentionUntil:string|null,now=Date.now()):LocationCoordinates|null{
 if(!result||typeof result!=='object')return null
 const value=result as {status:string;position?:{lat:number;lng:number};placeId?:string}
 if(value.status!=='resolved'||!value.position||!Number.isFinite(value.position.lat)||!Number.isFinite(value.position.lng)||Math.abs(value.position.lat)>90||Math.abs(value.position.lng)>180)return null
 // A one-day safety margin leaves maintenance time within Google's 30-day
 // limit; private source expiry can only shorten this interval.
 const until=Math.min(now+29*86400000,retentionUntil===null?Infinity:Date.parse(retentionUntil))
 if(!Number.isFinite(until)||until<=now)return null
 return {position:{...value.position},origin:'GOOGLE_GEOCODING',fetchedAt:new Date(now).toISOString(),expiresAt:new Date(until).toISOString(),
  ...(typeof value.placeId==='string'&&value.placeId.length<=256?{placeId:value.placeId}:{})}
}

import type {PoolClient} from 'pg'
import {OPERATION_CONTRACT,OperationDenied,operationPayloadDigest,type Json,type OperationContext} from '@profitia/platform-contracts/operation-context'
import {createDelegatedJobStore} from '@profitia/platform-contracts/delegated-job'
import {createSrmPrivateOperationHost} from './private-operation-host'
import {createSupplierLocationHost,type SupplierLocationRuntimeOptions} from './supplier-locations'
import {locationCollectionId,locationSourceEvidence} from './supplier-location-store'
import type {LocationSource} from '@profitia/srm-xray'
export type GeocodingSelection={organisationId:string;supplierId:string;locationId:string;address:string;addressVersion:string;expectedVersion:string;retentionUntil:string|null;alreadyResolved:boolean;uncertain:boolean;geocodingStatus:string;businessSchemaDigest?:string;supplierNip?:string;origin?:'SOURCE'|'MANUAL';group?:SupplierLocation['group'];sources?:LocationSource[]}
type Selection=GeocodingSelection
const refuse=():never=>{throw new OperationDenied('RESOURCE_VERSION_CONFLICT')}
/** Concrete SRM domain ports for the existing delegated Work host. No
 * connection, identity, source budget or provider implementation lives here. */
export function createSrmLocationGeocodingDomain(businessDigest:string){
 const parent=(context:Readonly<OperationContext>)=>{
  if(context.actorKind!=='SERVICE'||context.delegation?.target.operation!=='supplier.location.geocode'||context.delegation.target.application.appId!=='srm')return refuse()
  return context.delegation.requestId
 }
 return Object.freeze({
  async readCurrent(context:Readonly<OperationContext>,client:PoolClient):Promise<Selection>{
   const row=(await client.query('SELECT srm.location_geocode_target($1::uuid) AS value',[parent(context)])).rows[0]?.value
   if(!row||row.businessSchemaDigest!==businessDigest)return refuse()
   return Object.freeze(row as Selection)
  },
  async storeCurrent(context:Readonly<OperationContext>,client:PoolClient,selection:Selection,result:unknown){
   const value=result as {status?:string;reason?:string}
   const coordinates=googleCoordinates(result,selection.retentionUntil)
   const status=coordinates?'RESOLVED':value.reason==='ambiguous'?'AMBIGUOUS':value.reason==='low-precision'?'LOW_PRECISION'
    :['delivery-unverified','cancelled'].includes(value.reason??'')?'DELIVERY_UNCERTAIN':value.reason==='quota'?'QUOTA_EXCEEDED':value.status==='unresolved'?'UNRESOLVED':'UNAVAILABLE'
   await client.query('SELECT srm.location_geocode_store($1::uuid,$2::uuid,$3,$4::bigint,$5::jsonb)',[parent(context),selection.locationId,selection.addressVersion,selection.expectedVersion,JSON.stringify({status,coordinates})])
  },
 })
}
export type TransientGeocodingResult=Readonly<{locationId:string;addressVersion:string;version:string;coordinates:LocationCoordinates}>
/** Request-local result, exposed only after Work OUTCOME and a fresh HUMAN
 * read. The guarded receiver advances CAS metadata but never stores Google data. */
export function createSrmTransientGeocodingDomain(businessDigest:string,transientSchemaDigest:string){
 const base=createSrmLocationGeocodingDomain(businessDigest)
 let completed:TransientGeocodingResult|undefined
 return Object.freeze({readCurrent:base.readCurrent,
  async storeCurrent(context:Readonly<OperationContext>,client:PoolClient,selection:Selection,result:unknown){
   const coordinates=googleCoordinates(result,selection.retentionUntil)
   if(!coordinates){await base.storeCurrent(context,client,selection,result);return}
   if(context.actorKind!=='SERVICE'||context.delegation?.target.operation!=='supplier.location.geocode')return refuse()
   const row=(await client.query('SELECT srm.location_geocode_transient_complete($1::uuid,$2::uuid,$3,$4::bigint,$5) AS version',
    [context.delegation.requestId,selection.locationId,selection.addressVersion,selection.expectedVersion,transientSchemaDigest])).rows[0]
   if(typeof row?.version!=='string'||!/^\d{1,18}$/.test(row.version))return refuse()
   completed=Object.freeze({locationId:selection.locationId,addressVersion:selection.addressVersion,version:row.version,
    coordinates:{...coordinates,expiresAt:new Date(Math.min(Date.parse(coordinates.expiresAt!),Date.parse(coordinates.fetchedAt)+15*60000)).toISOString()}})
  },
  result:()=>completed,
 })
}
export async function readSrmLocationGeocodingTarget(options:SupplierLocationRuntimeOptions,input:{request:Request;organisationId:string;supplierId:string;locationId:string}){
 await options.prepareAccess?.(input.request,input.organisationId,input.supplierId,input.locationId)
 const reader=createSupplierLocationHost(options,'supplier.location.read')
 return (await reader.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'supplier.location.read',organisationId:input.organisationId,resourceId:locationCollectionId(input.supplierId),
   payload:{action:'READ',supplierId:input.supplierId,locationId:null,addressVersion:null,expectedVersion:null,command:null},request:input.request},async(_context,client)=>{
    await client.query('SELECT srm.location_expire($1::uuid,$2::uuid)',[input.organisationId,input.supplierId])
    return (await client.query('SELECT srm.location_geocode_metadata($1::uuid,$2::uuid,$3::uuid,$4) AS value',[input.organisationId,input.supplierId,input.locationId,'supplier.location.read'])).rows[0]?.value as Selection|undefined})).value
}
type Job={schemaDigest:string;targetOperation:'supplier.location.geocode';supplierSchemaDigest:string;operationSchemaDigest:string;locationSchemaDigest:string}
/** Optional server composition. Missing adoption creates no intent, job or
 * provider call; SQL policies and registered bindings remain the paid gate. */
export function createSrmLocationGeocodingRequest(options:SupplierLocationRuntimeOptions,adoption?:Readonly<{executorApplicationId:string;job:Job}>){
 if(!adoption)return Object.freeze({request:async()=>({status:'WAITING_OWNER' as const,paidCalls:0 as const})})
 const store=createDelegatedJobStore({binding:options.binding,...adoption.job})
 if(adoption.job.targetOperation!=='supplier.location.geocode')throw TypeError('Exact existing geocode delegation required')
 // P1 parent attestation belongs only to manual WRITE/SYNC, not GEOCODE.
 const {ledger,businessDigest,readAcceptedKys:_,locationAdmission:__,parentSchemaDigest:___,...driver}=options
 const host=createSrmPrivateOperationHost({...driver,application:{...driver.application,operations:['supplier.location.geocode','supplier.report.read','supplier.private.read']},requestLedger:ledger,
  readResources:async({actor,request,scope,query})=>{
   const p=request.payload as unknown as {supplierId:string;locationId:string;addressVersion:string;command:{address:string;executorApplicationId:string}}
   if(actor.kind!=='HUMAN'||!scope.organisationId||request.resourceId!=='supplier-location-geocode:'+p.locationId)return refuse()
   const descriptor=(await query('SELECT srm.location_installation_descriptor() AS value')).rows[0]?.value as {locationBusinessSchemaDigest:string}|undefined
   if(descriptor?.locationBusinessSchemaDigest!==businessDigest)throw new OperationDenied('POLICY_UNAVAILABLE')
   const m=(await query('SELECT srm.location_geocode_metadata($1::uuid,$2::uuid,$3::uuid,$4) AS value',[scope.organisationId,p.supplierId,p.locationId,'supplier.location.geocode'])).rows[0]?.value as Selection|undefined
   if(!m||m.address!==p.command.address||p.command.executorApplicationId!==adoption.executorApplicationId)return refuse()
   return {resource:{id:request.resourceId,type:'supplier_location_geocode_request',dataClass:'OPERATION_AUDIT',environment:scope.environment,ownerOrganisationId:scope.organisationId,ownerUserId:actor.actorId,
    version:m.expectedVersion,projectionVersion:'srm-location-geocode-v1',supplierLocation:{supplierId:p.supplierId,locationId:p.locationId,group:m.group!,origin:m.origin!,addressVersion:m.addressVersion,targetVersion:m.expectedVersion,
     exists:true,serverAssignedId:false,commandDigest:operationPayloadDigest(p.command),executorApplicationId:adoption.executorApplicationId,sources:m.sources!.map(v=>locationSourceEvidence(v,scope.organisationId!,m.supplierNip!))}}}
  },projectOutput:value=>value,
 })
 return Object.freeze({async request(input:{request:Request;organisationId:string;supplierId:string;locationId:string}){
  const prepared=await readSrmLocationGeocodingTarget(options,input)
  if(!prepared)return{status:'UNRESOLVED' as const,paidCalls:0 as const}
  if(prepared.alreadyResolved)return{status:'RESOLVED' as const,paidCalls:0 as const}
  if(prepared.uncertain)return{status:'DELIVERY_UNCERTAIN' as const,paidCalls:0 as const}
  if(!['UNREQUESTED','EXPIRED'].includes(prepared.geocodingStatus))return{status:'UNRESOLVED' as const,paidCalls:0 as const}
  const payload={action:'GEOCODE',supplierId:input.supplierId,locationId:input.locationId,addressVersion:prepared.addressVersion,expectedVersion:prepared.expectedVersion,command:{address:prepared.address,executorApplicationId:adoption.executorApplicationId}}
  const key='srm-geocode-'+operationPayloadDigest({organisationId:input.organisationId,supplierId:input.supplierId,locationId:input.locationId,addressVersion:prepared.addressVersion,expectedVersion:prepared.expectedVersion})
  const result=await host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'supplier.location.geocode',organisationId:input.organisationId,resourceId:'supplier-location-geocode:'+input.locationId,
   idempotencyKey:key,payload:payload as Json,request:input.request},async(context,client)=>{
    await store.createDispatch(client.query.bind(client),context)
    return{requestId:context.requestReservation!.requestId,status:'ACCEPTED'}
   })
  return{status:'ACCEPTED' as const,receipt:result.value as {requestId:string;status:'ACCEPTED'},payload}
 }})
}
