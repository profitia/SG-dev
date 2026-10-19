import {createDelegatedJobHost,type DelegatedJobHostOptions} from '../../src/private-operation-host.mjs'
import {createRequestContinuationLedger} from '../../src/request-continuation.mjs'
import type {OperationInput} from '../../src/operation-context.mjs'
declare const options:DelegatedJobHostOptions<{query():Promise<void>}>
declare const input:OperationInput
const job={schemaDigest:'a'.repeat(64),targetOperation:'supplier.report.refresh' as const,supplierSchemaDigest:'b'.repeat(64)}
const host=createDelegatedJobHost({...options,job,privateContinuation:{schemaDigest:'c'.repeat(64),delegatedSchemaDigest:'d'.repeat(64)}})
host.runPrivatePhase(input,{phaseId:'REGISTER_LOOKUP',inputDigest:'e'.repeat(64)},async(context,transaction)=>{await transaction.query();return{requestId:context.resourceId,status:'ACCEPTED'}})
// @ts-expect-error No provider or arbitrary phase is admitted by the public API.
host.runPrivatePhase(input,{phaseId:'FETCH_PROVIDER',inputDigest:'e'.repeat(64)},async c=>({requestId:c.resourceId,status:'ACCEPTED'}))
// @ts-expect-error The bounded callback cannot return vendor data or an arbitrary private object.
host.runPrivatePhase(input,{phaseId:'STORE_GENERAL',inputDigest:'e'.repeat(64)},async()=>({raw:'unbounded'}))
// @ts-expect-error No source delivery can coexist with a private phase host.
createDelegatedJobHost({...options,job,privateContinuation:{schemaDigest:'c'.repeat(64),delegatedSchemaDigest:'d'.repeat(64)},sourceDelivery:{}})
// @ts-expect-error Forecast cannot opt into Supplier private phases.
createDelegatedJobHost({...options,job:{schemaDigest:'a'.repeat(64)},privateContinuation:{schemaDigest:'c'.repeat(64),delegatedSchemaDigest:'d'.repeat(64)}})
const defaultHost=createDelegatedJobHost(options)
// @ts-expect-error A default dispatch host has no private phase entry.
defaultHost.runPrivatePhase(input,{phaseId:'REGISTER_LOOKUP',inputDigest:'e'.repeat(64)},async()=>({requestId:'x',status:'ACCEPTED'}))
createRequestContinuationLedger({executionMode:'DELEGATED_SERVICE',binding:options.binding,continuation:{requestId:'x',phaseId:'REGISTER_LOOKUP',inputDigest:'e'.repeat(64),schemaDigest:'c'.repeat(64),delegatedSchemaDigest:'d'.repeat(64)}})
// @ts-expect-error A delegated phase cannot be charged through an unrelated HUMAN ledger.
createRequestContinuationLedger({executionMode:'DELEGATED_SERVICE',binding:options.binding,continuation:{requestId:'x',phaseId:'REGISTER_LOOKUP',inputDigest:'e'.repeat(64),schemaDigest:'c'.repeat(64),delegatedSchemaDigest:'d'.repeat(64)},ledger:{}})
