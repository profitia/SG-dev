declare module '@profitia/maps-runtime/src/server/geocoding-command.mjs' {
 import type {PoolClient} from 'pg'
 import type {createDelegatedNativeWorkHost} from '@profitia/platform-contracts/private-operation-host'
 import type {createPlatformIngestionHost} from '@profitia/platform-contracts/platform-ingestion'
 import type {AccessQuery} from '@profitia/platform-contracts/access-store'
 import type {OperationInput} from '@profitia/platform-contracts/operation-context'
 import type {createSrmTransientGeocodingDomain} from './supplier-location-geocoding'
 export function createMapsGeocodingCommand(configuration:{
  service:Parameters<typeof createDelegatedNativeWorkHost<PoolClient>>[0]
  source:Omit<Parameters<typeof createPlatformIngestionHost<PoolClient>>[0],'source'|'validateSharedPayload'>&{
   independentQuery:AccessQuery;query:AccessQuery;external:{configurationVersion:string;schemaDigest:string;nativeSchemaDigest:string}}
  domain:ReturnType<typeof createSrmTransientGeocodingDomain>
  apiKey:string;referenceSecret:string;ownerAdoptionRef:string
 }):Readonly<{run(input:OperationInput):Promise<Readonly<{status:string;paidCalls:number|'UNKNOWN'}>>}>
}
