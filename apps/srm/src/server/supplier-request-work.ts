import type { PoolClient } from 'pg'
import { createDelegatedNativeWorkHost } from '@profitia/platform-contracts/private-operation-host'
import { createClerkAccountStatusReader } from '@profitia/platform-contracts/identity-provider'
import { OPERATION_CONTRACT, OperationDenied, operationPayloadDigest, type Json, type OperationContext } from '@profitia/platform-contracts/operation-context'
import { createSrmNativePgDriver } from './native-pg-driver'
import { readSupplierRequest, supplierRequestResourceId, type SupplierRequestCommand } from './supplier-request-operation'
import type { SupplierServiceContinuationOptions } from './supplier-request-continuation'

/** Reviewed SQL purposes, not an effect ledger or provider dispatch contract. */
export const SUPPLIER_NATIVE_WORK_UNITS = Object.freeze({
  SRM_REGISTER_LOOKUP:'WRITE', SRM_CACHE_READ:'READ', SRM_GENERAL_METADATA_READ:'READ',
  SRM_FINANCIAL_REPROJECT_READ:'READ', SRM_STORE_GENERAL:'WRITE', SRM_STORE_FINANCIAL:'WRITE',
  SRM_ARCHIVE_GENERAL:'WRITE', SRM_ARCHIVE_FINANCIAL:'WRITE', SRM_PREPARE_DOCUMENTS:'WRITE',
  SRM_READ_DOCUMENTS:'READ', SRM_MSR_CANDIDATES:'READ', SRM_MSR_READ:'READ',
  SRM_MSR_CLAIM:'WRITE', SRM_MSR_RECEIVE:'WRITE', SRM_MSR_SAVE:'WRITE',
  SRM_MSR_PROJECT:'WRITE', SRM_MSR_BLOCK:'WRITE', SRM_RECORD_INTEREST:'WRITE',
} as const)
/** Sensitive purposes are registered separately; adding code grants no policy. */
export const SUPPLIER_SENSITIVE_WORK_UNITS = Object.freeze({
  SRM_SENSITIVE_REGISTER:'WRITE', SRM_SENSITIVE_STATUS:'READ', SRM_SENSITIVE_REPLAY:'READ', SRM_SENSITIVE_PURGE:'WRITE',
  SRM_JDG_START:'WRITE', SRM_JDG_STORE:'WRITE', SRM_JDG_FINISH:'WRITE', SRM_KYS_STORE:'WRITE',
  SRM_KYS_CACHE_READ:'READ', SRM_KYS_CACHE_CLAIM:'WRITE', SRM_KYS_CACHE_SAVE:'WRITE',
  SRM_KYS_CACHE_HOLD:'WRITE', SRM_KYS_CACHE_RENEW:'WRITE', SRM_KYS_CACHE_RELEASE:'WRITE',
} as const)
const allNativeUnits = Object.freeze({...SUPPLIER_NATIVE_WORK_UNITS,...SUPPLIER_SENSITIVE_WORK_UNITS})
export type SupplierSensitiveWorkUnit = keyof typeof SUPPLIER_SENSITIVE_WORK_UNITS
export type SupplierNativeWorkUnit = keyof typeof allNativeUnits
export type SupplierNativeWorkSelection = Readonly<{requestId:string;organisationId:string;command:SupplierRequestCommand}>
export type SupplierNativeWorkOptions = Omit<SupplierServiceContinuationOptions,
  'executionMode'|'continuationSchemaDigest'|'delegatedSchemaDigest'|'delegatedBusinessBoundaryDigest'> & {
  workSchemaDigest:string;workBusinessBoundaryDigest:string
}
export interface SupplierNativeWork {
  run(selection:SupplierNativeWorkSelection,unitId:SupplierNativeWorkUnit,input:Readonly<Json>,
    action:(context:Readonly<OperationContext>,client:PoolClient)=>void|Promise<void>):Promise<Readonly<{requestId:string;unitId:SupplierNativeWorkUnit;status:'ACCEPTED'}>>
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const refuse=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}

/** Same common host, native driver and canonical audit. No captured dataset,
 * browser proof, provider client or long-running transaction lives here. */
export function createSrmSupplierNativeWork(options:SupplierNativeWorkOptions):Readonly<SupplierNativeWork>{
  const allowed=['pool','auditPool','clerk','now','transactionTimeoutMs','application','binding','job',
    'commandBoundaryDigest','accountIdentity','workSchemaDigest','workBusinessBoundaryDigest']
  if(typeof window!=='undefined'||!options||Object.getPrototypeOf(options)!==Object.prototype
    ||Object.keys(options).some(k=>!allowed.includes(k))||Reflect.ownKeys(options).length!==Object.keys(options).length
    ||Object.values(Object.getOwnPropertyDescriptors(options)).some(d=>!('value'in d)||!d.enumerable)
    ||!['commandBoundaryDigest','workSchemaDigest','workBusinessBoundaryDigest'].every(k=>/^[a-f0-9]{64}$/.test(options[k as keyof SupplierNativeWorkOptions] as string))
    ||options.accountIdentity?.environment!==options.application.environment)throw TypeError('Explicit native Supplier work binding required')
  const fixed=freeze(structuredClone({application:options.application,binding:options.binding,job:options.job,
    commandBoundaryDigest:options.commandBoundaryDigest,workSchemaDigest:options.workSchemaDigest,
    workBusinessBoundaryDigest:options.workBusinessBoundaryDigest}))
  const host=createDelegatedNativeWorkHost<PoolClient>({application:fixed.application,binding:fixed.binding,job:fixed.job,
    privateWork:{schemaDigest:fixed.workSchemaDigest},now:options.now,transactionTimeoutMs:options.transactionTimeoutMs,
    readExternalAccount:createClerkAccountStatusReader({client:options.clerk,...options.accountIdentity,now:options.now}),
    ...createSrmNativePgDriver(options.pool,options.auditPool)})
  return Object.freeze({
    async run(selection:SupplierNativeWorkSelection,unitId:SupplierNativeWorkUnit,input:Readonly<Json>,
      action:(context:Readonly<OperationContext>,client:PoolClient)=>void|Promise<void>){
      if(!selection||Object.getPrototypeOf(selection)!==Object.prototype
        ||Object.keys(selection).sort().join(',')!=='command,organisationId,requestId'
        ||Reflect.ownKeys(selection).length!==3||Object.values(Object.getOwnPropertyDescriptors(selection)).some(d=>!('value'in d)||!d.enumerable)
        ||!uuid.test(selection.requestId)||!uuid.test(selection.organisationId)
        ||!Object.hasOwn(allNativeUnits,unitId)||typeof action!=='function')return refuse()
      const selected=freeze({...selection,command:readSupplierRequest(selection.command)})
      // Binding is a digest of server-selected parameters; those parameters are
      // captured by the domain adapter, not replayed as a second common body.
      const inputDigest=operationPayloadDigest(input as Json),accessMode=allNativeUnits[unitId]
      let performed=false
      const receipt=await host.runSqlWork({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
        operation:'job.execute',organisationId:selected.organisationId,resourceId:selected.requestId,payload:selected.command,request:null},
      {unitId,accessMode,inputDigest},async(context,client)=>{
        const work=context.requestWork
        if(performed||context.actorKind!=='SERVICE'||context.applicationId!==fixed.application.appId
          ||context.actorId===context.subjectUserId||context.organisationId!==selected.organisationId
          ||context.delegation?.subjectUserId!==context.subjectUserId||context.delegation.target.application.appId!=='srm'
          ||context.delegation.target.operation!=='supplier.report.refresh'||context.delegation.target.resourceId!==supplierRequestResourceId(selected.command)
          ||context.payloadDigest!==operationPayloadDigest(selected.command)||context.requestContinuation!==undefined||context.requestInspection!==undefined
          ||work?.requestId!==selected.requestId||work.unitId!==unitId||work.accessMode!==accessMode
          ||work.inputDigest!==inputDigest||work.schemaDigest!==fixed.workSchemaDigest)return refuse()
        const d=(await client.query('SELECT srm.current_supplier_work($1::uuid,$2::uuid,$3) AS descriptor',
          [selected.organisationId,selected.requestId,selected.command.nip])).rows[0]?.descriptor
        if(!d||d.workBusinessSchemaVersion!=='1.0.0'||d.workBusinessBoundaryDigest!==fixed.workBusinessBoundaryDigest
          ||d.commandBoundaryDigest!==fixed.commandBoundaryDigest||d.applicationId!==context.applicationId
          ||d.parentApplicationId!=='srm'||d.subjectUserId!==context.subjectUserId
          ||d.nip!==selected.command.nip||d.unitId!==unitId||d.accessMode!==accessMode)return refuse()
        const commands=await client.query('SELECT command_json FROM profitia_supplier_requests.commands WHERE request_id=$1::uuid',[selected.requestId])
        if(commands.rows.length!==1||operationPayloadDigest(readSupplierRequest(commands.rows[0].command_json))!==context.payloadDigest)return refuse()
        await client.query("SELECT set_config('srm.organization_id',$1,true)",[selected.organisationId])
        if(await action(context,client)!==undefined)return refuse()
        performed=true
      })
      if(!performed||receipt.value.requestId!==selected.requestId||receipt.value.status!=='ACCEPTED')return refuse()
      return Object.freeze({requestId:selected.requestId,unitId,status:'ACCEPTED' as const})
    },
  })
}
