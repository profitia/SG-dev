import {createDelegatedPrivateInspectionHost,type DelegatedJobHostOptions} from '../../src/private-operation-host.mjs'
import type {OperationInput} from '../../src/operation-context.mjs'
declare const options:DelegatedJobHostOptions<object>&{job:{schemaDigest:string;targetOperation:'supplier.report.refresh';supplierSchemaDigest:string};privateInspection:{schemaDigest:string;continuationSchemaDigest:string;delegatedSchemaDigest:string}}
declare const input:OperationInput
const host=createDelegatedPrivateInspectionHost(options)
void host.inspectPrivatePhase(input,{phaseId:'REGISTER_LOOKUP'},async context=>{
 const phase=context.requestInspection?.phaseId
 void phase
 // @ts-expect-error Evidence is immutable and cannot be converted to another phase.
 context.requestInspection!.phaseId='STORE_GENERAL'
})
// @ts-expect-error An inspection host exposes no dispatch admission.
void host.admit(input)
// @ts-expect-error An inspection host exposes no write phase method.
void host.runPrivatePhase(input,{phaseId:'REGISTER_LOOKUP',inputDigest:'a'},()=>undefined)
// @ts-expect-error Closed accepted phase selector.
void host.inspectPrivatePhase(input,{phaseId:'ARBITRARY_READ'},()=>undefined)
// @ts-expect-error Returning arbitrary private output is not the server callback contract.
void host.inspectPrivatePhase(input,{phaseId:'REGISTER_LOOKUP'},async()=>({private:'data'}))
// @ts-expect-error Source delivery cannot be mixed into a read host.
createDelegatedPrivateInspectionHost({...options,sourceDelivery:{deliver:async()=>({})}})
