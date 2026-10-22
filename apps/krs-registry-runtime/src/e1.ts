import {createExternalCallHost,externalCallEvidence,nativeExternalTransportSchemaDigest} from '@profitia/platform-contracts/external-call'
import type {ExternalCallOptions,NativeExternalTransport} from '@profitia/platform-contracts/external-call'
import type {RegistryCommand} from '@profitia/krs-registry-contracts'
import {buildRequest,parseCommand,KRS_ORIGIN} from './client.js'
import {RegistryError} from './errors.js'
/** Existing E1 owns Source PLAN/ATTEMPT/SETTLE, current grants, budgets, audit and durable receipts. */
export async function createAdmittedKrsSource<T>(options:Omit<ExternalCallOptions<T,RegistryCommand>,'parseCommand'|'buildRequest'|'getHeaders'|'publicWebTransport'>){
  if(options.binding.origin!==KRS_ORIGIN||options.binding.transport!=='HTTPS')throw new RegistryError('SOURCE_BINDING_DENIED')
  const nativeTransport:NativeExternalTransport&{credentialMode:'NONE'}={schemaDigest:await nativeExternalTransportSchemaDigest(),credentialMode:'NONE',completionMode:'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT',maximumResponseBytes:4*1024*1024,redirectOrigins:[],pathRules:[
    {method:'GET',prefix:'/api/krs/OdpisAktualny/',parameter:'OPAQUE',suffix:'',requestFormat:'NONE'},
    {method:'GET',prefix:'/api/krs/OdpisPelny/',parameter:'OPAQUE',suffix:'',requestFormat:'NONE'},
    {method:'GET',prefix:'/api/Krs/Biuletyn/',parameter:'OPAQUE',suffix:'',requestFormat:'NONE'},
    {method:'GET',prefix:'/api/Krs/BiuletynGodzinowy/',parameter:'OPAQUE',suffix:'',requestFormat:'NONE'}
  ]}
  const host=createExternalCallHost({...options,parseCommand,buildRequest,nativeTransport})
  return Object.freeze({async execute(input:{command:unknown;intentKey:string},limits?:{signal?:AbortSignal}){
    const response=await host.execute(input,limits)
    const evidence=externalCallEvidence(response)
    if(evidence?.transportProtocol!=='profitia.external-native-http'||evidence.status!=='RESPONSE'||evidence.sourceId!==options.sourceId||evidence.resourceId!==options.resourceId)throw new RegistryError('SOURCE_SETTLEMENT_UNAVAILABLE',null,'UNVERIFIED')
    return response
  }})
}
export type RegistryOperation='supplier.registry.read'|'supplier.registry.search'|'supplier.registry.resolve'
/** Proposed adapter boundary; not an access engine. An accepted producer must supply its protected operation executor.
 * Its transaction encloses the read and OUTCOME audit and rechecks revocation. No caller org/user is authoritative. */
export interface RegistryReadBoundary {
  execute<T>(input:{operation:RegistryOperation;request:unknown;selection:Readonly<Record<string,string>>},read:()=>Promise<T>):Promise<T>
}
export const unavailableReadBoundary:RegistryReadBoundary=Object.freeze({async execute(){throw new RegistryError('E1_REGISTRY_PRODUCER_UNAVAILABLE')}})
/** The producer supplies a current admitted catalog SQL transaction and accepted Source receipt.
 * No local receipt/grant ledger is introduced. Physical cross-database publication remains unaccepted. */
export interface CatalogPublicationBoundary<Transaction> {
  publish<T>(input:{intentKey:string;contentDigest:string},write:(transaction:Transaction,effectRef:string)=>Promise<T>):Promise<T>
}
export function unavailablePublication<T>():CatalogPublicationBoundary<T>{return {async publish(){throw new RegistryError('E1_CATALOG_PUBLICATION_UNAVAILABLE')}}}
