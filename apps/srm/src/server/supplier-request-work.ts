import type { PoolClient } from 'pg'
import { createDelegatedNativeWorkHost } from '@profitia/platform-contracts/private-operation-host'
import { createClerkAccountStatusReader } from '@profitia/platform-contracts/identity-provider'
import { OPERATION_CONTRACT, OperationDenied, operationPayloadDigest, type Json, type OperationContext } from '@profitia/platform-contracts/operation-context'
import { createSrmNativePgDriver } from './native-pg-driver'
import {LookupStageError,sanitizedLookupFailure} from './lookup-diagnostics'
import {measureSupplierStage,measureSupplierWork} from './supplier-telemetry'
import { readSupplierRequest, supplierRequestResourceId, privateSupplierRequestResourceId, readSupplierPrivateAcquisition, type SupplierPrivateAcquisition, type SupplierRequestCommand } from './supplier-request-operation'
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
export const SUPPLIER_WEB_WORK_UNITS=Object.freeze({SRM_WEB_SUBJECT_READ:'READ',SRM_WEB_CLAIM:'WRITE',SRM_WEB_SAVE:'WRITE'} as const)
const allNativeUnits = Object.freeze({...SUPPLIER_NATIVE_WORK_UNITS,...SUPPLIER_SENSITIVE_WORK_UNITS,...SUPPLIER_WEB_WORK_UNITS})
export type SupplierSensitiveWorkUnit = keyof typeof SUPPLIER_SENSITIVE_WORK_UNITS
export type SupplierNativeWorkUnit = keyof typeof allNativeUnits
export type SupplierNativeWorkSelection = Readonly<{requestId:string;organisationId:string;command:SupplierRequestCommand}>
export type SupplierNativeWorkOptions = Omit<SupplierServiceContinuationOptions,
  'executionMode'|'continuationSchemaDigest'|'delegatedSchemaDigest'|'delegatedBusinessBoundaryDigest'|'job'> & {
  workSchemaDigest:string;workBusinessBoundaryDigest:string;privateAcquisition?:SupplierPrivateAcquisition
  job:SupplierServiceContinuationOptions['job']|{schemaDigest:string;targetOperation:'supplier.private.refresh';supplierSchemaDigest:string;operationSchemaDigest:string}
}
export interface SupplierNativeWork {
  run(selection:SupplierNativeWorkSelection,unitId:SupplierNativeWorkUnit,input:Readonly<Json>,
    action:(context:Readonly<OperationContext>,client:PoolClient)=>void|Promise<void>):Promise<Readonly<{requestId:string;unitId:SupplierNativeWorkUnit;status:'ACCEPTED'}>>
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const refuse=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
const invariantLabels=new Map([
 ['Explicit current native Supplier work required','NATIVE_CONTEXT'],
 ['SRM native work transaction scope mismatch','NATIVE_SCOPE'],
 ['SRM application role must enforce row-level security','ROLE_ISOLATION'],
 ['SRM bound transaction context mismatch','ORGANISATION_CONTEXT'],
 ['SRM organization must be provisioned before runtime use','ORGANISATION_PROVISIONING'],
 ['Accepted lookup identity conflicts with its current owner or command','LOOKUP_IDENTITY'],
])
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}

/** Same common host, native driver and canonical audit. No captured dataset,
 * browser proof, provider client or long-running transaction lives here. */
export function createSrmSupplierNativeWork(options:SupplierNativeWorkOptions):Readonly<SupplierNativeWork>{
  const allowed=['pool','auditPool','clerk','now','transactionTimeoutMs','application','binding','job',
    'commandBoundaryDigest','accountIdentity','workSchemaDigest','workBusinessBoundaryDigest','privateAcquisition']
  if(typeof window!=='undefined'||!options||Object.getPrototypeOf(options)!==Object.prototype
    ||Object.keys(options).some(k=>!allowed.includes(k))||Reflect.ownKeys(options).length!==Object.keys(options).length
    ||Object.values(Object.getOwnPropertyDescriptors(options)).some(d=>!('value'in d)||!d.enumerable)
    ||!['commandBoundaryDigest','workSchemaDigest','workBusinessBoundaryDigest'].every(k=>/^[a-f0-9]{64}$/.test(options[k as keyof SupplierNativeWorkOptions] as string))
    ||options.accountIdentity?.environment!==options.application.environment)throw TypeError('Explicit native Supplier work binding required')
  const acquisition=options.privateAcquisition===undefined?undefined:readSupplierPrivateAcquisition(options.privateAcquisition)
  if(options.job.targetOperation!==(acquisition?'supplier.private.refresh':'supplier.report.refresh'))throw TypeError('Explicit native request target required')
  const targetId=(command:SupplierRequestCommand)=>acquisition?privateSupplierRequestResourceId(command,{entityType:acquisition.entityType,section:acquisition.section}):supplierRequestResourceId(command)
  const fixed=freeze(structuredClone({application:options.application,binding:options.binding,job:options.job,
    commandBoundaryDigest:options.commandBoundaryDigest,workSchemaDigest:options.workSchemaDigest,
    workBusinessBoundaryDigest:options.workBusinessBoundaryDigest}))
  const host=createDelegatedNativeWorkHost<PoolClient>({application:fixed.application,binding:fixed.binding,job:fixed.job,
    revalidateExternalAccountBeforeOutcome:true,
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
      const receipt=await measureSupplierWork(unitId,()=>host.runSqlWork({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
        operation:'job.execute',organisationId:selected.organisationId,resourceId:selected.requestId,payload:selected.command,request:null},
      {unitId,accessMode,inputDigest},async(context,client)=>{
       let phase='BUSINESS_DESCRIPTOR'
       try{
        const work=context.requestWork
        if(performed||context.actorKind!=='SERVICE'||context.applicationId!==fixed.application.appId
          ||context.actorId===context.subjectUserId||context.organisationId!==selected.organisationId
          ||context.delegation?.subjectUserId!==context.subjectUserId||context.delegation.target.application.appId!=='srm'
          ||context.delegation.target.operation!==fixed.job.targetOperation||context.delegation.target.resourceId!==targetId(selected.command)
          ||context.payloadDigest!==operationPayloadDigest(selected.command)||context.requestContinuation!==undefined||context.requestInspection!==undefined
          ||work?.requestId!==selected.requestId||work.unitId!==unitId||work.accessMode!==accessMode
          ||work.inputDigest!==inputDigest||work.schemaDigest!==fixed.workSchemaDigest)return refuse()
        const d=(await client.query('SELECT srm.current_supplier_work($1::uuid,$2::uuid,$3) AS descriptor',
          [selected.organisationId,selected.requestId,selected.command.nip])).rows[0]?.descriptor
        if(!d||d.workBusinessSchemaVersion!=='1.0.0'||d.workBusinessBoundaryDigest!==fixed.workBusinessBoundaryDigest
          ||d.commandBoundaryDigest!==fixed.commandBoundaryDigest||d.applicationId!==context.applicationId
          ||d.parentApplicationId!=='srm'||d.subjectUserId!==context.subjectUserId
          ||d.nip!==selected.command.nip||d.unitId!==unitId||d.accessMode!==accessMode
          ||acquisition&&(d.privateAcquisitionSchemaVersion!=='1.0.0'||d.privateAcquisitionBoundaryDigest!==acquisition.boundaryDigest
            ||d.entityType!==acquisition.entityType||d.section!==acquisition.section
            ||d.operation!=='supplier.private.refresh')
          ||acquisition?.section==='web'&&(d.webWork!==true||d.webSchemaVersion!=='1.0.0'||d.webBoundaryDigest!==acquisition.webBoundaryDigest)
          ||!acquisition&&d.operation!=='supplier.report.refresh')return refuse()
        const commands=await client.query('SELECT command_json FROM profitia_supplier_requests.commands WHERE request_id=$1::uuid',[selected.requestId])
        if(commands.rows.length!==1||operationPayloadDigest(readSupplierRequest(commands.rows[0].command_json))!==context.payloadDigest)return refuse()
        await client.query("SELECT set_config('srm.organization_id',$1,true)",[selected.organisationId])
        phase='DOMAIN_ACTION'
        if(await measureSupplierStage('DOMAIN_ACTION',()=>Promise.resolve(action(context,client)))!==undefined)return refuse()
        performed=true
       }catch(error){
        const cause=error instanceof LookupStageError?error.cause:error
        const invariant=cause instanceof Error?invariantLabels.get(cause.message):undefined
        console.error('Native Supplier work failed',{unitId,phase,...sanitizedLookupFailure(error),...(invariant?{invariant}:{})})
        throw error
       }
      }))
      if(!performed||receipt.value.requestId!==selected.requestId||receipt.value.status!=='ACCEPTED')return refuse()
      return Object.freeze({requestId:selected.requestId,unitId,status:'ACCEPTED' as const})
    },
  })
}
