import type pg from 'pg'
import type { PoolClient } from 'pg'
import { createPlatformDeliveryPort, createPlatformIngestionHost } from '@profitia/platform-contracts/platform-ingestion'
import { OperationDenied, operationPayloadDigest } from '@profitia/platform-contracts/operation-context'
import { createSrmNativePgDriver } from './native-pg-driver'
import { readSupplierRequest } from './supplier-request-operation'

export const SUPPLIER_SOURCE_REQUEST_VERSION='srm-supplier-source-request-v1'
export const SUPPLIER_SOURCE_REQUEST=Object.freeze({id:'srm.supplier.source-request',payloadSchema:'supplier-command-v1',
  qualityVersion:SUPPLIER_SOURCE_REQUEST_VERSION,classificationVersion:'srm-supplier-source-request-control-v1'})
type RootOptions=Parameters<typeof createPlatformIngestionHost<PoolClient>>[0]
const refuse=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}

/** Short independent SQL admission, not acquisition or a second dispatch
 * ledger. No customer identity, history, billing, credentials or network. */
export function createSrmSupplierSourceRequest(options:{application:RootOptions['application'];binding:RootOptions['binding'];
  pool:pg.Pool;auditPool:pg.Pool;requestSchemaDigest:string;now?:()=>number}){
  if(typeof window!=='undefined'||options.application.appId!=='srm-provider-source'
    ||!/^[a-f0-9]{64}$/.test(options.requestSchemaDigest))throw TypeError('Explicit Supplier Source binding required')
  const fixed=structuredClone({application:options.application,binding:options.binding,requestSchemaDigest:options.requestSchemaDigest})
  const driver=createSrmNativePgDriver(options.pool,options.auditPool)
  async function verify(client:PoolClient){
    const d=(await client.query('SELECT profitia_srm_acquisition.runtime_descriptor() AS descriptor')).rows[0]?.descriptor
    if(!d||d.version!==SUPPLIER_SOURCE_REQUEST_VERSION||d.schemaDigest!==fixed.requestSchemaDigest
      ||d.rootSchemaDigest!==fixed.binding.schemaDigest)return refuse()
  }
  const host=createPlatformIngestionHost<PoolClient>({...fixed,source:SUPPLIER_SOURCE_REQUEST,...driver,now:options.now,
    validateSharedPayload:async(value,session)=>{readSupplierRequest(value);await verify(session.transaction);return true}})
  const port=createPlatformDeliveryPort({host,resourceId:value=>readSupplierRequest(value).nip,
    write:async(value,client,context)=>{
      const command=readSupplierRequest(value);await verify(client)
      if(!context.platformReservation?.effectId)return refuse()
      const result=await client.query('SELECT profitia_srm_acquisition.admit($1,$2::uuid,$3::uuid) AS admitted',
        [command.nip,context.platformReservation.effectId,context.decisionId])
      if(result.rows[0]?.admitted!==true)return refuse()
    }})
  return Object.freeze({port,
    async read(input:unknown,deliveryKey:string){
      const command=readSupplierRequest(input)
      if(!/^[a-f0-9]{64}$/.test(deliveryKey))return refuse()
      // This is an existing-record observation, never a call to ingest/deliver.
      // Its serialized result cannot mint Root platformReceiptEvidence.
      return driver.transact(async({transaction:client})=>{
        await verify(client)
        const root=(await client.query('SELECT current_database() AS database_name,current_user AS role,session_user AS login,profitia_ingestion.runtime_descriptor() AS descriptor')).rows[0]
        const d=root?.descriptor,b=fixed.binding
        if(!d||root.database_name!==b.databaseName||root.role!==b.role||root.login!==b.role
          ||d.applicationId!==b.applicationId||d.environment!==b.environment||d.projectId!==b.projectId
          ||d.branchId!==b.branchId||d.databaseName!==b.databaseName||d.role!==b.role||d.schemaDigest!==b.schemaDigest
          ||d.deploymentId!==b.deploymentId||d.configurationVersion!==b.configurationVersion)return refuse()
        const key=operationPayloadDigest({applicationId:b.applicationId,environment:b.environment,serviceId:d.serviceId,
          sourceId:SUPPLIER_SOURCE_REQUEST.id,key:deliveryKey})
        const value=(await client.query('SELECT profitia_srm_acquisition.receipt($1,$2) AS receipt',[command.nip,key])).rows[0]?.receipt
        if(!value||Object.keys(value).sort().join(',')!=='effectId,status'||value.status!=='COMMITTED'
          ||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value.effectId))return refuse()
        return Object.freeze({effectId:value.effectId as string,status:'COMMITTED' as const})
      },{timeoutMs:10000,maxWaitMs:3000})
    },
  })
}
