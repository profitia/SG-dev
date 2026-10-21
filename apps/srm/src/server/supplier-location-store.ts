import {createHash} from 'node:crypto'
import type {PoolClient} from 'pg'
import {operationPayloadDigest,type Json,type OperationContext} from '@profitia/platform-contracts/operation-context'
import type {ManualLocationInput,LocationSource,SupplierLocationPage} from '@profitia/srm-xray'
import {sourceAddressVersion,type LocationProjection} from './supplier-location-sync'
export const LOCATION_COLLECTION_PREFIX='supplier-locations:'
export const locationCollectionId=(supplierId:string)=>LOCATION_COLLECTION_PREFIX+supplierId
export function canonicalLocationJson(value:unknown):string{
 if(value===null||typeof value==='boolean'||typeof value==='string'||typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value)
 if(Array.isArray(value))return '['+value.map(canonicalLocationJson).join(',')+']'
 if(value&&Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalLocationJson((value as Record<string,unknown>)[k])).join(',')+'}'
 throw TypeError('Closed JSON location command required')
}
export function assignedLocationId(org:string,supplier:string,key:string):string{
 const h=createHash('sha256').update(canonicalLocationJson(['srm-location-id-v1',org,supplier,key])).digest('hex')
 return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32)
}
export const locationCommandDigest=(v:unknown)=>operationPayloadDigest(v as Json)
export type LocationPayload=Readonly<{action:'READ'|'CREATE'|'UPDATE'|'DEACTIVATE'|'SYNC';supplierId:string;locationId:string|null;addressVersion:string|null;expectedVersion:string|null;command:Json}>
export async function readLocationPage(context:Readonly<OperationContext>,client:PoolClient,supplierId:string,group:string,offset:number,limit:number):Promise<SupplierLocationPage>{
 await client.query('SELECT srm.location_expire($1::uuid,$2::uuid)',[context.organisationId,supplierId])
 const v=(await client.query('SELECT srm.location_page($1::uuid,$2::uuid,$3,$4,$5) AS page',[context.organisationId,supplierId,group,offset,limit])).rows[0]?.page
 if(!v||!Array.isArray(v.items)||!Number.isSafeInteger(Number(v.total))||v.coverage?.branches!=='NOT_CONFIRMED')throw Error('Stored location page unavailable')
 return {...v,supplierId,offset,limit,hasMore:offset+v.items.length<Number(v.total),total:Number(v.total)}
}
export async function writeManualLocation(context:Readonly<OperationContext>,client:PoolClient,p:LocationPayload){
 const reservation=context.requestReservation;if(!reservation)throw Error('Admitted Root reservation required')
 await client.query('SELECT srm.location_manual_write($1::uuid,$2::uuid,$3::uuid,$4,$5::bigint,$6::uuid,$7,$8,$9)',
  [context.organisationId,p.supplierId,p.locationId,p.action,p.expectedVersion,reservation.requestId,context.payloadDigest,canonicalLocationJson(p.command),p.addressVersion])
 return {requestId:reservation.requestId,status:'ACCEPTED' as const}
}
export async function reconcileLocations(context:Readonly<OperationContext>,client:PoolClient,p:LocationPayload,rows:readonly (LocationProjection&{id:string;addressVersion:string})[]){
 const reservation=context.requestReservation;if(!reservation)throw Error('Admitted Root reservation required')
 await client.query('SELECT srm.location_sync_write($1::uuid,$2::uuid,$3::bigint,$4::uuid,$5,$6,$7::jsonb)',
  [context.organisationId,p.supplierId,p.expectedVersion,reservation.requestId,context.payloadDigest,canonicalLocationJson(p.command),JSON.stringify(rows)])
 return {requestId:reservation.requestId,status:'ACCEPTED' as const}
}
export function manualAddressVersion(command:ManualLocationInput){return sourceAddressVersion({address:command.address,originalAddress:null})}
export function locationSourceEvidence(source:LocationSource,org:string,nip:string){
 const base={id:source.kind==='KYS'?'supplier-private-report:kys:COMPANY:'+nip:'supplier-report:COMPANY:'+source.reportId.split(':')[1],
  version:source.version,projectionVersion:source.kind==='KYS'?'srm-sensitive-supplier-v1':'srm-location-accepted-mgbi-v1',environment:'development' as const,ownerUserId:null}
 return source.kind==='MGBI'?{kind:source.kind,accepted:true as const,entityType:'COMPANY' as const,retentionUntil:source.retentionUntil,
  resource:{...base,type:'supplier_report' as const,dataClass:'SHARED_KNOWLEDGE' as const,ownerOrganisationId:null,approvedSharedProjection:true as const}}
 :{kind:source.kind,accepted:true as const,entityType:'COMPANY' as const,retentionUntil:source.retentionUntil,
  resource:{...base,type:'supplier_private_report' as const,dataClass:'ORGANISATION_PRIVATE' as const,ownerOrganisationId:org,
   privateSupplier:{nip,entityType:'COMPANY' as const,snapshotId:source.version,retentionUntil:source.retentionUntil!}}}
}
