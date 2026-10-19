import {createDelegatedNativeWorkHost,createDelegatedJobHost,type DelegatedJobHostOptions} from '../../src/private-operation-host.mjs'
import type {OperationInput} from '../../src/operation-context.mjs'
declare const options:DelegatedJobHostOptions<object>&{job:{schemaDigest:string;targetOperation:'supplier.report.refresh';supplierSchemaDigest:string};privateWork:{schemaDigest:string}}
declare const input:OperationInput
const host=createDelegatedNativeWorkHost(options)
void host.runSqlWork(input,{unitId:'PREPARE_DOCUMENTS',accessMode:'WRITE',inputDigest:'a'},async context=>{
 const mode:'READ'|'WRITE'|undefined=context.requestWork?.accessMode
 void mode
 // @ts-expect-error Current evidence is immutable.
 context.requestWork!.accessMode='READ'
})
// @ts-expect-error A native unit exposes no dispatch admission.
void host.admit(input)
// @ts-expect-error A native unit exposes no accepted-phase inspection method.
void host.inspectPrivatePhase(input,{phaseId:'REGISTER_LOOKUP'},()=>undefined)
// @ts-expect-error Access mode is closed.
void host.runSqlWork(input,{unitId:'PREPARE_DOCUMENTS',accessMode:'ADMIN',inputDigest:'a'},()=>undefined)
// @ts-expect-error No private business result is returned by the callback.
void host.runSqlWork(input,{unitId:'PREPARE_DOCUMENTS',accessMode:'WRITE',inputDigest:'a'},async()=>({private:'data'}))
// @ts-expect-error Source delivery is a separate authority.
createDelegatedNativeWorkHost({...options,sourceDelivery:{deliver:async()=>({})}})

// @ts-expect-error A native work binding is not a default dispatch host configuration.
createDelegatedJobHost(options)
