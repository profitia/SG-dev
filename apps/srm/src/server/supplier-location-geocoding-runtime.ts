import type pg from 'pg'
import {createMapsGeocodingCommand} from '@profitia/maps-runtime/src/server/geocoding-command.mjs'
import {createClerkAccountStatusReader} from '@profitia/platform-contracts/identity-provider'
import {OPERATION_CONTRACT,OperationDenied,type Application} from '@profitia/platform-contracts/operation-context'
import type {ExternalCallOptions} from '@profitia/platform-contracts/external-call'
import {createSrmNativePgDriver} from './native-pg-driver'
import {createSrmLocationGeocodingDomain,createSrmLocationGeocodingRequest,createSrmTransientGeocodingDomain,readSrmLocationGeocodingTarget,readSrmPersistedLocationCoordinates,type TransientGeocodingResult} from './supplier-location-geocoding'
import {measureLocation} from './supplier-location-telemetry'
import type {SupplierLocationRuntime,SupplierLocationRuntimeOptions} from './supplier-locations'
import type {Configuration} from './supplier-native-runtime'
import nativeTargets from '../../deployment/supplier-native-targets.json'
import locationTargets from '../../deployment/supplier-location-targets.json'
import mgbiPolicy from '../../deployment/mgbi-unmetered-policy.json'
import cacheAcceptance from '../../deployment/supplier-location-cache-2026-10-31.json'
type Env=Readonly<Record<string,string|undefined>>
export const LOCATION_GEOCODING_VERSION='srm-google-geocoding-transient-v1'
export const LOCATION_CACHED_GEOCODING_VERSION='srm-google-geocoding-cache-v1'
export function readSrmLocationGeocodingConfiguration(env:Env,locationsEnabled:boolean,native?:Configuration){
 const version=env.PROFITIA_SUPPLIER_LOCATION_GEOCODING_VERSION
 if(version===undefined)return undefined
 if(![LOCATION_GEOCODING_VERSION,LOCATION_CACHED_GEOCODING_VERSION].includes(version)||!locationsEnabled||!native||native.runtimeRoles
  ||native.base.application.appId!=='srm'||native.base.application.environment!=='development'
  ||native.base.binding.projectId!==locationTargets.projectId||native.base.binding.branchId!==locationTargets.branchId
  ||env.RENDER_SERVICE_ID!==locationTargets.serviceId||!env.GOOGLE_GEOCODING_API_KEY?.trim())throw new OperationDenied('POLICY_UNAVAILABLE')
 return Object.freeze({apiKey:env.GOOGLE_GEOCODING_API_KEY.trim(),referenceSecret:native.referenceSecret,
  ...(version===LOCATION_CACHED_GEOCODING_VERSION?{cacheSchemaDigest:cacheAcceptance.schemaDigest}:{})})
}
type Pools=Readonly<{jobs:pg.Pool;jobsAudit:pg.Pool;source:pg.Pool;sourceAudit:pg.Pool}>
/** Source PLAN/ATTEMPT/SETTLE must use the host's admitted transaction. */
export const querySrmGeocodingTransaction:ExternalCallOptions<pg.PoolClient,unknown>['query']=async(transaction,sql,values=[])=>({rows:(await transaction.query(sql,values)).rows})
/** Adopts the pinned Maps command in SRM; shares the existing ordinary pools.
 * No public address proxy or owner credential. The optional cache uses the
 * existing receiver and a separately admitted retention installation. */
export function createSrmLocationGeocodingRuntime(options:SupplierLocationRuntimeOptions,locations:SupplierLocationRuntime,native:Configuration,pools:Pools,config:NonNullable<ReturnType<typeof readSrmLocationGeocodingConfiguration>>){
 if(config.cacheSchemaDigest&&config.cacheSchemaDigest!==options.locationCacheSchemaDigest)throw new OperationDenied('POLICY_UNAVAILABLE')
 const core=nativeTargets.coreSchemaDigests,version=native.configurationVersion
 const job={schemaDigest:core['007-delegated-jobs.sql'],targetOperation:'supplier.location.geocode' as const,
  supplierSchemaDigest:core['013-supplier-delegation.sql'],operationSchemaDigest:core['017-additional-request-operations.sql'],locationSchemaDigest:locationTargets.sql019Digest}
 const requester=createSrmLocationGeocodingRequest(options,{executorApplicationId:'srm-jobs',job})
 const application=(appId:string,features:string[],operations:Application['operations']):Application=>({appId,profileId:'PLATFORM_INTERNAL',environment:'development',
  deploymentId:native.base.application.deploymentId+':'+appId,configurationVersion:version,identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features,operations})
 const jobsApplication=application('srm-jobs',['job_execution'],['job.execute'])
 const service={application:jobsApplication,binding:{...options.binding,applicationId:'srm-jobs',role:nativeTargets.runtimeRoles.jobs,
  service:{schemaDigest:core['005-service-read.sql'],profileId:'PLATFORM_INTERNAL' as const,deploymentId:jobsApplication.deploymentId,configurationVersion:version}},
  job,privateWork:{schemaDigest:core['016-delegated-native-work.sql']},revalidateExternalAccountBeforeOutcome:true as const,
  ...createSrmNativePgDriver(pools.jobs,pools.jobsAudit),readExternalAccount:createClerkAccountStatusReader({environment:'development',issuer:options.identity.issuer,client:options.clerk})}
 const sourceApplication=application('srm-provider-source',['knowledge_ingestion'],['knowledge.ingest'])
 const source={application:sourceApplication,binding:{...options.binding,applicationId:sourceApplication.appId,role:nativeTargets.runtimeRoles.providerSource,
  deploymentId:sourceApplication.deploymentId,configurationVersion:version,schemaDigest:core['008-platform-ingestion.sql'],unmeteredSchemaDigest:mgbiPolicy.unmeteredSchemaDigest},
  ...createSrmNativePgDriver(pools.source,pools.sourceAudit),query:querySrmGeocodingTransaction,
  external:{configurationVersion:version,schemaDigest:core['009-external-call-admission.sql'],nativeSchemaDigest:core['012-native-external-transport.sql']}}
 return Object.freeze({async resolve(input:{request:Request;organisationId:string;supplierId:string;locationId:string}){
  const admitted=await requester.request(input)
  const presentation=(value:TransientGeocodingResult)=>({...value,coordinates:{...value.coordinates,
   expiresAt:new Date(Math.min(Date.parse(value.coordinates.expiresAt!),Date.now()+15*60000)).toISOString()}})
  if(admitted.status!=='ACCEPTED'){
   if(admitted.status==='RESOLVED'&&config.cacheSchemaDigest){
    const current=await readSrmPersistedLocationCoordinates(options,input)
    return{...admitted,...(current?{transient:presentation(current)}:{})}
   }
   return admitted
  }
  const transient=config.cacheSchemaDigest?undefined:createSrmTransientGeocodingDomain(options.businessDigest,locationTargets.transientGeocoding.schemaDigest)
  const domain=transient??createSrmLocationGeocodingDomain(options.businessDigest,config.cacheSchemaDigest)
  const command=createMapsGeocodingCommand({service,source,domain,apiKey:config.apiKey,referenceSecret:config.referenceSecret,ownerAdoptionRef:native.base.application.deploymentId.slice(-40)})
  const outcome=await measureLocation('geocodingCommand',()=>command.run({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'job.execute',
   organisationId:input.organisationId,resourceId:admitted.receipt.requestId,payload:admitted.payload,request:null}))
  const completed=transient?.result()??(config.cacheSchemaDigest&&outcome.status==='RESOLVED'?await readSrmPersistedLocationCoordinates(options,input):undefined)
  if(outcome.status!=='RESOLVED'||!completed)return{status:outcome.status,paidCalls:outcome.paidCalls}
  if(config.cacheSchemaDigest){
   if(completed.addressVersion!==admitted.payload.addressVersion)throw new OperationDenied('RESOURCE_VERSION_CONFLICT')
   return{status:'RESOLVED',paidCalls:outcome.paidCalls,transient:presentation(completed)}
  }
  // Never publish before committed E1 OUTCOME and a fresh initiating HUMAN read.
  const current=await readSrmLocationGeocodingTarget(options,input)
  if(!current||current.addressVersion!==completed.addressVersion||current.expectedVersion!==completed.version)throw new OperationDenied('RESOURCE_VERSION_CONFLICT')
  return{status:'RESOLVED',paidCalls:outcome.paidCalls,transient:completed}
 }})
}
export type SrmLocationGeocodingRuntime=ReturnType<typeof createSrmLocationGeocodingRuntime>
