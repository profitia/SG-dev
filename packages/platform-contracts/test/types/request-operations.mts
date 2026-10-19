import {createPrivateOperationHost,createDelegatedNativeWorkHost,type DelegatedJobHostOptions} from '../../src/private-operation-host.mjs'
import {createRequestLedger} from '../../src/request-ledger.mjs'
import {createDelegatedJobStore} from '../../src/delegated-job.mjs'
import type {AccessStoreBinding} from '../../src/access-store.mjs'
import type {OperationInput,OperationId} from '../../src/operation-context.mjs'
declare const binding:AccessStoreBinding
declare const options:DelegatedJobHostOptions<object>&{job:{schemaDigest:string;targetOperation:'benchmark.discovery.request';supplierSchemaDigest:string;operationSchemaDigest:string};privateWork:{schemaDigest:string}}
declare const input:OperationInput
const host=createDelegatedNativeWorkHost(options)
void host.runSqlWork(input,{unitId:'FINDER_SAVE',accessMode:'WRITE',inputDigest:'hash'},async c=>{const op:OperationId|undefined=c.delegation?.target.operation;void op})
createRequestLedger({binding,schemaDigest:'base',operation:'supplier.private.refresh',externalSchemaDigest:'external',operationSchemaDigest:'new'})
// @ts-expect-error A new request requires its own exact extension acceptance.
createRequestLedger({binding,schemaDigest:'base',operation:'supplier.private.refresh',externalSchemaDigest:'external'})
// @ts-expect-error A new delegated target requires its own exact extension acceptance.
createDelegatedJobStore({binding,schemaDigest:'base',targetOperation:'benchmark.discovery.request',supplierSchemaDigest:'supplier'})
// @ts-expect-error Forecast work is not implicitly enabled by the new targets.
createDelegatedNativeWorkHost({...options,job:{schemaDigest:'base',targetOperation:'forecast.request'}})
// @ts-expect-error Work cannot return a private business body through the job receipt.
host.runSqlWork(input,{unitId:'FINDER_SAVE',accessMode:'WRITE',inputDigest:'hash'},async()=>({private:'body'}))
void createPrivateOperationHost
