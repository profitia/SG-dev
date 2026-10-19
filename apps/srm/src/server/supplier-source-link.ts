import type { PoolClient } from 'pg'
import { createDelegatedJobHost } from '@profitia/platform-contracts/private-operation-host'
import { createClerkAccountStatusReader } from '@profitia/platform-contracts/identity-provider'
import { platformDeliveryEvidence } from '@profitia/platform-contracts/platform-ingestion'
import { OPERATION_CONTRACT, OperationDenied, operationPayloadDigest, type DelegatedJob } from '@profitia/platform-contracts/operation-context'
import { createSrmNativePgDriver } from './native-pg-driver'
import { createSrmSupplierNativeWork, type SupplierNativeWork, type SupplierNativeWorkOptions, type SupplierNativeWorkSelection } from './supplier-request-work'
import { createSrmSupplierNativeWorkStore } from './supplier-native-work-store'
import { readSupplierRequest } from './supplier-request-operation'
import { SUPPLIER_SOURCE_REQUEST, type createSrmSupplierSourceRequest } from './supplier-source-request'

const refuse=():never=>{throw new OperationDenied('DELEGATION_INVALID')}

/** Same original registration, native Work host and delegated dispatch.
 * Captured link metadata is released only after the real register COMMIT.
 * No incoming HTTP delivery key, empty metadata action or alternate writer. */
export function createSrmSupplierSourceLink(options:{work:SupplierNativeWorkOptions;namedInterestBoundaryDigest:string;
  source:ReturnType<typeof createSrmSupplierSourceRequest>}){
  if(typeof window!=='undefined'||!options.source?.port||!platformDeliveryEvidence(options.source.port))return refuse()
  const work=createSrmSupplierNativeWork(options.work),source=options.source
  const {application,binding,job,pool,auditPool,clerk,accountIdentity,now,transactionTimeoutMs}=options.work
  const dispatch=createDelegatedJobHost<PoolClient>({application,binding,job,now,transactionTimeoutMs,
    ...createSrmNativePgDriver(pool,auditPool),sourceDelivery:source.port,
    readExternalAccount:createClerkAccountStatusReader({client:clerk,...accountIdentity,now})})
  return Object.freeze({
    async registerAndAdmit(input:SupplierNativeWorkSelection){
      const selection={requestId:input.requestId,organisationId:input.organisationId,command:readSupplierRequest(input.command)}
      let captured:Readonly<DelegatedJob>|undefined,entered=false
      const capture:SupplierNativeWork={run:async(s,unit,manifest,action)=>{
        try{return await work.run(s,unit,manifest,async(context,client)=>{
          if(entered||unit!=='SRM_REGISTER_LOOKUP')return refuse();entered=true
          await action(context,client)
          const d=context.delegation,actual=platformDeliveryEvidence(source.port)
          if(!d||!actual||d.sourceId!==SUPPLIER_SOURCE_REQUEST.id||actual.sourceId!==d.sourceId
            ||d.organisationId!==selection.organisationId||d.requestId!==selection.requestId
            ||d.payloadDigest!==operationPayloadDigest(selection.command)
            ||actual.environment!==application.environment
            ||Object.keys(d.sourceBinding).some(k=>d.sourceBinding[k as keyof typeof d.sourceBinding]!==actual[k as keyof typeof actual]))return refuse()
          captured=structuredClone(d)
        })}catch(error){captured=undefined;throw error}
      }}
      try{
        const store=createSrmSupplierNativeWorkStore({work:capture,namedInterestBoundaryDigest:options.namedInterestBoundaryDigest})
        const lookup=await store.register(selection),link=captured
        if(!entered||!link)return refuse()
        const operation={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
          operation:'job.execute' as const,organisationId:selection.organisationId,resourceId:selection.requestId,payload:selection.command,request:null}
        let admitted=(await dispatch.admit(operation)).value
        if(admitted.status==='READY')admitted=(await dispatch.deliver!(operation,admitted)).value
        if(admitted.status!=='CONFIRMED')return Object.freeze({lookup,sourceStatus:admitted.status,sourceRequest:null})
        const sourceRequest=await source.read(selection.command,link.deliveryKey)
        return Object.freeze({lookup,sourceStatus:'CONFIRMED' as const,sourceRequest})
      }finally{captured=undefined}
    },
  })
}
