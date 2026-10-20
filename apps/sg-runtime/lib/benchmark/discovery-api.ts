import type {Prisma} from '@prisma/client'
import {OPERATION_CONTRACT,isOperationDenied,operationPayloadDigest,type OperationExecutor} from '@profitia/platform-contracts/operation-context'
import {ExternalCallUnavailable} from '@profitia/platform-contracts/external-call'
import {readPresentationJson} from '@profitia/platform-contracts/embedded-read-channel'
import {BenchmarkAppError} from './errors'
import {runWithBenchmarkProviderScope,type BenchmarkProviderPorts} from './provider-scope'
import {readDiscoveryCommand,discoveryRequestResourceId,discoveryResultResourceId,readPrivateDiscovery,type DiscoveryCommand} from './discovery-operation'
import type {createDiscoveryRequestPersister,createSg2DiscoveryNativeStore} from './discovery-native'

type Executor=OperationExecutor<Prisma.TransactionClient>
export type DiscoveryApiOptions={requestHost:Executor;readHost:Executor;persist:ReturnType<typeof createDiscoveryRequestPersister>;
 work:ReturnType<typeof createSg2DiscoveryNativeStore>;providerPorts:(operationKey:string)=>BenchmarkProviderPorts}
export type DiscoveryApi=Readonly<{execute:(request:Request,organisationId:string,command:Readonly<DiscoveryCommand>,idempotencyKey:string)=>Promise<Response>}>
export function discoveryFailure(status=503,code='OPERATION_DENIED',message='Operation unavailable'){
 return Response.json({error:{code,message}},{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}})
}
export function discoveryDenied(error:unknown){
 const reason=isOperationDenied(error)?error.reasonCode:null
 return discoveryFailure(reason==='UNVERIFIED_IDENTITY'?401:reason==='CONTEXT_INVALID'?400:
  reason&& !['AUDIT_UNAVAILABLE','POLICY_UNAVAILABLE'].includes(reason)?403:503)
}
async function originalBusiness(command:Readonly<DiscoveryCommand>){
 // Original business modules are loaded only after the actual HUMAN and native
 // work checks. Their algorithms and DTOs are shared with the existing Finder.
 if(command.kind==='AI_SEARCH')return (await import('./ai-search')).runBenchmarkAiSearch(command.prompt)
 const service=await import('./service')
 switch(command.kind){
  case 'SEARCH':return {items:await service.searchBenchmarks(command)}
  case 'METADATA':return {items:await service.getBenchmarkMetadataDefinitions()}
  case 'METADATA_VALUES':return service.getBenchmarkMetadataValues(command.metadataKey,command.filters,{query:command.query,limit:command.limit})
  case 'CONTEXT':return {items:await service.getBenchmarkSemanticContext(command.seriesIds)}
 }
}

/** One foreground request, standard delegation and native work composition.
 * Source admission never grants the current HUMAN permission to read a result.
 * Nothing publishes the provider value until a separate fresh private read. */
export function createSg2DiscoveryApi(options:DiscoveryApiOptions):DiscoveryApi{
 if(typeof window!=='undefined'||!options||options.requestHost===options.readHost||typeof options.providerPorts!=='function')throw TypeError('Explicit Finder receiving composition required')
 const admit=(request:Request,organisationId:string,command:Readonly<DiscoveryCommand>,idempotencyKey:string)=>options.requestHost.execute({
  contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'benchmark.discovery.request',
  organisationId,resourceId:discoveryRequestResourceId(command),payload:command,idempotencyKey,request},options.persist)
 return Object.freeze({async execute(request,organisationId,input,idempotencyKey){
  try{
   const command=readDiscoveryCommand(input)
   const accepted=await readPresentationJson((await admit(request,organisationId,command,idempotencyKey)).value,1024) as {requestId:string}
   const selected={requestId:accepted.requestId,organisationId,command}
   if(!await options.work.read(selected)){
    try{
     const key=operationPayloadDigest({version:'sg2-finder-source-v1',requestId:selected.requestId})
     const result=await runWithBenchmarkProviderScope(options.providerPorts(key),()=>originalBusiness(command))
     await options.work.save(selected,result)
    }catch(error){
     // Preserve the useful original clarification code, without disclosing the
     // generated intent or private intermediate data. Recheck current HUMAN
     // authority even for this generic error. A retry keeps its original Source
     // keys; it cannot buy another exchange for an uncertain/settled request.
     if(error instanceof BenchmarkAppError&&error.code==='AI_NEEDS_CLARIFICATION'){
      await admit(request,organisationId,command,idempotencyKey)
      return discoveryFailure(422,'AI_NEEDS_CLARIFICATION','Please clarify the benchmark description.')
     }
     throw error
    }
   }
   return (await options.readHost.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
    operation:'benchmark.discovery.read',organisationId,resourceId:discoveryResultResourceId(selected.requestId),
    payload:{requestId:selected.requestId},request},readPrivateDiscovery)).value
  }catch(error){return error instanceof ExternalCallUnavailable?discoveryFailure():discoveryDenied(error)}
 }})
}
