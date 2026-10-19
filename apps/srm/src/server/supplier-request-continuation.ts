import type { PoolClient } from 'pg'
import { OPERATION_CONTRACT, OperationDenied, operationPayloadDigest, type Json, type OperationContext, type Application, type Environment } from '@profitia/platform-contracts/operation-context'
import { readPresentationJson } from '@profitia/platform-contracts/embedded-read-channel'
import {createDelegatedJobHost} from '@profitia/platform-contracts/private-operation-host'
import type {AccessStoreBinding} from '@profitia/platform-contracts/access-store'
import {createClerkAccountStatusReader,type ClerkIdentityClient} from '@profitia/platform-contracts/identity-provider'
import {createSrmNativePgDriver} from './native-pg-driver'
import { validRequestIdempotencyKey } from '@profitia/platform-contracts/request-ledger'
import { createSrmSupplierRequestOperationHost } from './private-runtime'
import { readSupplierRequest, supplierRequestResourceId, type SupplierRequestCommand } from './supplier-request-operation'

export const SUPPLIER_PRIVATE_PHASES = Object.freeze(['REGISTER_LOOKUP','STORE_GENERAL','STORE_FINANCIAL','RECORD_INTEREST'] as const)
export type SupplierPrivatePhase = typeof SUPPLIER_PRIVATE_PHASES[number]
export const MAX_PRIVATE_PHASE_BYTES = 1024 * 1024
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const deny = (reason: 'CONTEXT_INVALID' | 'POLICY_UNAVAILABLE' | 'RESOURCE_SCOPE_MISMATCH' = 'RESOURCE_SCOPE_MISMATCH'): never => { throw new OperationDenied(reason) }
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
type HostOptions = Parameters<typeof createSrmSupplierRequestOperationHost>[0]
type HumanOptions = Omit<HostOptions, 'requestContinuation'> & { continuationSchemaDigest: string; executionMode?: never }
export type SupplierPrivatePhaseInput = Readonly<{
  requestId: string; phaseId: SupplierPrivatePhase; organisationId: string
  command: SupplierRequestCommand; idempotencyKey: string; request: Request; data: Json
}>

/** Server composition of the existing native host. It exposes no new HTTP
 * endpoint, alternate identity, policy engine, audit writer or provider port. */
function createHumanContinuation(options: HumanOptions) {
  if (typeof window !== 'undefined' || !/^[a-f0-9]{64}$/.test(options.continuationSchemaDigest)
    || Object.hasOwn(options, 'requestContinuation')) throw new TypeError('Explicit server-owned continuation source required')
  const schemaDigest = options.continuationSchemaDigest
  const { pool, auditPool, clerk, now, transactionTimeoutMs } = options
  const captured: HostOptions = { pool, auditPool, clerk, now, transactionTimeoutMs,
    ...structuredClone({ application: options.application, identity: options.identity, binding: options.binding,
      module: options.module, requestLedger: options.requestLedger, commandBoundaryDigest: options.commandBoundaryDigest }) }
  // Construction validates the unchanged supplier-only native configuration;
  // it does not authenticate, read a database or retain any actor/transaction.
  createSrmSupplierRequestOperationHost(captured)
  return Object.freeze({
    async run(input: SupplierPrivatePhaseInput,
      action: (context: Readonly<OperationContext>, client: PoolClient, data: Readonly<Json>) => void | Promise<void>) {
      if (!input || Object.getPrototypeOf(input) !== Object.prototype
        || Object.keys(input).sort().join(',') !== 'command,data,idempotencyKey,organisationId,phaseId,request,requestId'
        || !uuid.test(input.requestId) || !uuid.test(input.organisationId)
        || !SUPPLIER_PRIVATE_PHASES.includes(input.phaseId) || !validRequestIdempotencyKey(input.idempotencyKey)
        || !(input.request instanceof Request) || input.request.signal.aborted || typeof action !== 'function') return deny('CONTEXT_INVALID')
      const { requestId, phaseId, organisationId, idempotencyKey, request } = input
      const command = readSupplierRequest(input.command)
      const data=await readPhaseData(input.data)
      const inputDigest = operationPayloadDigest(data)
      const host = createSrmSupplierRequestOperationHost({ ...captured,
        requestContinuation: { requestId, phaseId, inputDigest, schemaDigest } })
      let performed = false
      const result = await host.execute({ contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version,
        operation: 'supplier.report.refresh', organisationId, resourceId: supplierRequestResourceId(command),
        payload: command, idempotencyKey, request,
      }, async (context, client) => {
        const continuation = context.requestContinuation
        if (request.signal.aborted || !continuation || continuation.requestId !== requestId || continuation.phaseId !== phaseId
          || continuation.inputDigest !== inputDigest || continuation.schemaDigest !== schemaDigest
          || context.requestReservation?.requestId !== requestId || context.requestReservation.replay !== false
          || context.applicationId !== 'srm' || context.actorKind !== 'HUMAN' || context.organisationId !== organisationId
          || context.payloadDigest !== operationPayloadDigest(command)) return deny()
        const row = await client.query('SELECT command_json FROM profitia_supplier_requests.commands WHERE request_id=$1::uuid', [requestId])
        if (row.rows.length !== 1 || operationPayloadDigest(readSupplierRequest(row.rows[0].command_json)) !== context.payloadDigest) return deny()
        if (await action(context, client, data) !== undefined || request.signal.aborted) return deny()
        performed = true
        return Object.freeze({ requestId, status: 'ACCEPTED' as const })
      })
      const publication: unknown = result.value
      if (!(publication instanceof Response) || publication.status !== 202) return deny('POLICY_UNAVAILABLE')
      const receipt: unknown = await publication.json()
      if (!receipt || typeof receipt !== 'object' || Object.keys(receipt).sort().join(',') !== 'requestId,status'
        || !('requestId' in receipt) || receipt.requestId !== requestId || !('status' in receipt) || receipt.status !== 'ACCEPTED') return deny('POLICY_UNAVAILABLE')
      // execute resolves after the actual native COMMIT. Failure/unknown COMMIT
      // propagates; this function never replays work or reports rollback itself.
      return Object.freeze({ requestId, phaseId, status: performed ? 'COMMITTED' as const : 'REPLAY' as const })
    },
  })
}


export type SupplierServicePhaseInput = Readonly<{
  requestId:string;phaseId:SupplierPrivatePhase;organisationId:string;command:SupplierRequestCommand;data:Json
}>
export interface SupplierServiceContinuation {
  readonly executionMode:'DELEGATED_SERVICE'
  run(input:SupplierServicePhaseInput,action:(context:Readonly<OperationContext>,client:PoolClient,data:Readonly<Json>)=>void|Promise<void>):Promise<Readonly<{requestId:string;phaseId:SupplierPrivatePhase;status:'COMMITTED'|'REPLAY'}>>
}
export type SupplierServiceContinuationOptions=Pick<HostOptions,'pool'|'auditPool'|'now'|'transactionTimeoutMs'>&{
  executionMode:'DELEGATED_SERVICE';clerk:Pick<ClerkIdentityClient,'users'>
  application:Application;binding:AccessStoreBinding&{service:NonNullable<AccessStoreBinding['service']>}
  job:{schemaDigest:string;targetOperation:'supplier.report.refresh';supplierSchemaDigest:string}
  continuationSchemaDigest:string;delegatedSchemaDigest:string;commandBoundaryDigest:string;delegatedBusinessBoundaryDigest:string
  accountIdentity:{environment:Environment;issuer:string}
}
export function createSrmSupplierRequestContinuation(options:SupplierServiceContinuationOptions):Readonly<SupplierServiceContinuation>
export function createSrmSupplierRequestContinuation(options:HumanOptions):ReturnType<typeof createHumanContinuation>
export function createSrmSupplierRequestContinuation(options:HumanOptions|SupplierServiceContinuationOptions){
  if(options.executionMode==='DELEGATED_SERVICE')return createServiceContinuation(options)
  if(options.executionMode!==undefined)throw TypeError('Unknown Supplier private execution mode')
  return createHumanContinuation(options)
}

/** Existing native driver and common host; no alternative identity, policy,
 * effect writer or network executor. A fresh real SQL SERVICE remains distinct
 * from the current initiating account. No browser Request is retained. */
function createServiceContinuation(options:SupplierServiceContinuationOptions):Readonly<SupplierServiceContinuation>{
  const allowed=['executionMode','pool','auditPool','clerk','now','transactionTimeoutMs','application','binding','job',
    'continuationSchemaDigest','delegatedSchemaDigest','commandBoundaryDigest','delegatedBusinessBoundaryDigest','accountIdentity']
  if(typeof window!=='undefined'||Object.keys(options).some(k=>!allowed.includes(k))
    ||Reflect.ownKeys(options).length!==Object.keys(options).length
    ||Object.values(Object.getOwnPropertyDescriptors(options)).some(d=>!('value'in d)||!d.enumerable)
    ||!['continuationSchemaDigest','delegatedSchemaDigest','commandBoundaryDigest','delegatedBusinessBoundaryDigest'].every(k=>/^[a-f0-9]{64}$/.test(options[k as keyof SupplierServiceContinuationOptions] as string))
    ||!options.accountIdentity||options.accountIdentity.environment!==options.application.environment)throw TypeError('Explicit delegated native Supplier continuation required')
  const fixed=freeze(structuredClone({application:options.application,binding:options.binding,job:options.job,
    continuationSchemaDigest:options.continuationSchemaDigest,delegatedSchemaDigest:options.delegatedSchemaDigest,
    commandBoundaryDigest:options.commandBoundaryDigest,delegatedBusinessBoundaryDigest:options.delegatedBusinessBoundaryDigest}))
  const host=createDelegatedJobHost<PoolClient>({application:fixed.application,binding:fixed.binding,job:fixed.job,
    now:options.now,transactionTimeoutMs:options.transactionTimeoutMs,
    privateContinuation:{schemaDigest:fixed.continuationSchemaDigest,delegatedSchemaDigest:fixed.delegatedSchemaDigest},
    readExternalAccount:createClerkAccountStatusReader({client:options.clerk,...options.accountIdentity,now:options.now}),
    ...createSrmNativePgDriver(options.pool,options.auditPool)})
  return Object.freeze({executionMode:'DELEGATED_SERVICE' as const,
    async run(input:SupplierServicePhaseInput,action:(context:Readonly<OperationContext>,client:PoolClient,data:Readonly<Json>)=>void|Promise<void>){
      if(!input||Object.getPrototypeOf(input)!==Object.prototype
        ||Object.keys(input).sort().join(',')!=='command,data,organisationId,phaseId,requestId'
        ||!uuid.test(input.requestId)||!uuid.test(input.organisationId)||!SUPPLIER_PRIVATE_PHASES.includes(input.phaseId)
        ||typeof action!=='function')return deny('CONTEXT_INVALID')
      const {requestId,phaseId,organisationId}=input,command=readSupplierRequest(input.command)
      const data=await readPhaseData(input.data),inputDigest=operationPayloadDigest(data)
      let performed=false
      const result=await host.runPrivatePhase({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
        operation:'job.execute',organisationId,resourceId:requestId,payload:command,request:null},
        {phaseId,inputDigest},async(context,client)=>{
          const current=context.requestContinuation
          if(context.actorKind!=='SERVICE'||context.applicationId!==fixed.application.appId||context.organisationId!==organisationId
            ||!context.subjectUserId||context.delegation?.subjectUserId!==context.subjectUserId
            ||context.delegation.target.application.appId!=='srm'||context.delegation.target.operation!=='supplier.report.refresh'
            ||context.delegation.target.resourceId!==supplierRequestResourceId(command)
            ||context.payloadDigest!==operationPayloadDigest(command)||!current||current.requestId!==requestId
            ||current.phaseId!==phaseId||current.inputDigest!==inputDigest||current.schemaDigest!==fixed.continuationSchemaDigest
            ||current.delegatedSchemaDigest!==fixed.delegatedSchemaDigest)return deny()
          const descriptor=(await client.query('SELECT srm.delegated_supplier_descriptor($1::uuid,$2) AS descriptor',[requestId,phaseId])).rows[0]?.descriptor
          if(!descriptor||descriptor.delegatedBusinessSchemaVersion!=='1.0.0'
            ||descriptor.delegatedBusinessBoundaryDigest!==fixed.delegatedBusinessBoundaryDigest
            ||descriptor.commandBoundaryDigest!==fixed.commandBoundaryDigest
            ||descriptor.applicationId!==context.applicationId||descriptor.parentApplicationId!=='srm')return deny()
          const row=await client.query('SELECT command_json FROM profitia_supplier_requests.commands WHERE request_id=$1::uuid',[requestId])
          if(row.rows.length!==1||operationPayloadDigest(readSupplierRequest(row.rows[0].command_json))!==context.payloadDigest)return deny()
          if(await action(context,client,data)!==undefined)return deny()
          performed=true;return Object.freeze({requestId,status:'ACCEPTED' as const})
        })
      if(!result.value||Object.keys(result.value).sort().join(',')!=='requestId,status'
        ||result.value.requestId!==requestId||result.value.status!=='ACCEPTED')return deny('POLICY_UNAVAILABLE')
      return Object.freeze({requestId,phaseId,status:performed?'COMMITTED' as const:'REPLAY' as const})
    }
  })
}

async function readPhaseData(input:Json):Promise<Json>{
  try{
    const expected=operationPayloadDigest(input),text=JSON.stringify(input)
    if(!text||Buffer.byteLength(text)>MAX_PRIVATE_PHASE_BYTES)return deny('CONTEXT_INVALID')
    const data=freeze(await readPresentationJson(new Response(text,{headers:{'content-type':'application/json'}}),MAX_PRIVATE_PHASE_BYTES))
    if(operationPayloadDigest(data)!==expected)return deny('CONTEXT_INVALID')
    return data
  }catch{return deny('CONTEXT_INVALID')}
}
