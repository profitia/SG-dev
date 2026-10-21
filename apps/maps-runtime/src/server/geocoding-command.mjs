import {createHmac} from 'node:crypto'
import {createDelegatedNativeWorkHost} from '@profitia/platform-contracts/private-operation-host'
import {createPlatformIngestionHost} from '@profitia/platform-contracts/platform-ingestion'
import {createExternalCallHost,externalNativeResponse,ExternalCallUnavailable} from '@profitia/platform-contracts/external-call'
import {operationPayloadDigest} from '@profitia/platform-contracts/operation-context'
import {geocodeAddress} from './google/geocoding.mjs'

const keys='action,callId,configurationVersion,httpStatus,intentDigest,requestDigest,responseDigest,status'
export const GOOGLE_GEOCODING_SOURCE=Object.freeze({id:'maps.provider.google.geocoding',payloadSchema:'external-call-control-v1',qualityVersion:'maps-geocoding-control-v1',classificationVersion:'technical-source-control-v1'})
const path='/maps/api/geocode/json',origin='https://maps.googleapis.com'
/** No public route, token verifier, local quota or retry ledger. The installed
 * Root delegation, current account/target and Source SQL budget admit effects.
 * Missing operator adoption remains a zero-call state. */
export function createMapsGeocodingCommand(configuration){
 if(!configuration)return Object.freeze({run:async()=>({status:'WAITING_OWNER',paidCalls:0})})
 const {service,source,domain,apiKey,referenceSecret,ownerAdoptionRef}=configuration
 if(typeof ownerAdoptionRef!=='string'||!/^[a-f0-9]{40}$/.test(ownerAdoptionRef)||typeof referenceSecret!=='string'||referenceSecret.length<32
  ||typeof apiKey!=='string'||!apiKey||service?.job?.targetOperation!=='supplier.location.geocode'
  ||source?.application?.environment!=='development'||service?.application?.environment!=='development'
  ||typeof domain?.readCurrent!=='function'||typeof domain?.storeCurrent!=='function')throw TypeError('Explicit reviewed native geocoding adoption required')
 const work=createDelegatedNativeWorkHost(service)
 const sourceHost=createPlatformIngestionHost({...source,source:GOOGLE_GEOCODING_SOURCE,validateSharedPayload:value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys})
 const external=createExternalCallHost({sourceHost,sourceId:GOOGLE_GEOCODING_SOURCE.id,resourceId:'maps-provider:google-geocoding',
  binding:{role:source.binding.role,configurationVersion:source.external.configurationVersion,schemaDigest:source.external.schemaDigest,
   origin,transport:'HTTPS',pathRules:[{method:'GET',path}]},
  nativeTransport:{schemaDigest:source.external.nativeSchemaDigest,pathRules:[{method:'GET',path,requestFormat:'NONE'}],redirectOrigins:[],maximumResponseBytes:262144,
   credentialMode:'NONE',completionMode:'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT'},
  independentQuery:source.independentQuery,query:source.query,
  parseCommand:value=>{if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).join(',')!=='address'||typeof value.address!=='string'||!value.address.trim()||value.address.length>512)throw new ExternalCallUnavailable('NOT_SENT');return{address:value.address}},
  buildRequest:command=>{const url=new URL(path,origin);url.searchParams.set('address',command.address);url.searchParams.set('key',apiKey);return{method:'GET',url:url.href,body:null}},
 })
 // This in-memory fence only coalesces simultaneous execution. Durable replay
 // and uncertain delivery belong to the existing E1/Source database mechanisms.
 const inFlight=new Map()
 return Object.freeze({async run(input){
  const logical=input?.resourceId
  if(typeof logical!=='string')throw TypeError('Existing delegated request required')
  const signature=operationPayloadDigest({contractId:input.contractId??null,contractVersion:input.contractVersion??null,operation:input.operation??null,organisationId:input.organisationId??null,resourceId:logical,payload:input.payload??null})
  if(inFlight.has(logical)){const active=inFlight.get(logical);if(active.signature!==signature)throw TypeError('Changed delegated request');return active.pending}
  const pending=(async()=>{
   let selected
   await work.runSqlWork(input,{unitId:'MAPS_GEOCODE_READ',accessMode:'READ',inputDigest:operationPayloadDigest({requestId:logical})},async(context,transaction)=>{
    selected=await domain.readCurrent(context,transaction)
   })
   if(selected?.alreadyResolved)return{status:'RESOLVED',paidCalls:0}
   if(selected?.uncertain)return{status:'DELIVERY_UNCERTAIN',paidCalls:0}
   if(!selected||typeof selected.address!=='string'||!selected.address.trim()||selected.address.length>512||!selected.addressVersion||!selected.expectedVersion)
    return {status:'UNRESOLVED',paidCalls:0}
   const intentKey=createHmac('sha256',referenceSecret).update(JSON.stringify(['maps-geocode-v1',selected.organisationId,selected.supplierId,selected.locationId,selected.addressVersion,selected.expectedVersion])).digest('hex')
   let result,certainty
   try{
    result=await geocodeAddress(selected.address,{apiKey,fetch:async(_url,options)=>{try{return externalNativeResponse(await external.execute({command:{address:selected.address},intentKey},{signal:options.signal}))}catch(error){certainty=error instanceof ExternalCallUnavailable?error.certainty:'UNVERIFIED';throw error}}})
   }catch(error){return{status:error instanceof ExternalCallUnavailable&&error.certainty==='NOT_SENT'?'UNAVAILABLE':'DELIVERY_UNCERTAIN',paidCalls:'UNKNOWN'}}
   if(certainty==='NOT_SENT')return{status:'UNAVAILABLE',paidCalls:0}
   // New current delegated SQL admission rechecks revocation/source validity.
   // Domain storage must compare exact location and address versions atomically.
   await work.runSqlWork(input,{unitId:'MAPS_GEOCODE_SAVE',accessMode:'WRITE',inputDigest:operationPayloadDigest({requestId:logical,addressVersion:selected.addressVersion,result})},async(context,transaction)=>{
    await domain.storeCurrent(context,transaction,selected,result)
   })
   return{status:result.status==='unavailable'&&['delivery-unverified','cancelled'].includes(result.reason)?'DELIVERY_UNCERTAIN':result.status.toUpperCase(),paidCalls:certainty?'UNKNOWN':1}
  })();inFlight.set(logical,{signature,pending})
  try{return await pending}finally{inFlight.delete(logical)}
 }})
}
