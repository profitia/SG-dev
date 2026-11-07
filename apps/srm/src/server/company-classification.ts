import type {PoolClient} from 'pg'
import {createDelegatedJobHost} from '@profitia/platform-contracts/private-operation-host'
import {createRootAtomicClaimDeliveryHost,type CommittedRootClaim} from '@profitia/platform-root-atomic-claim'
import {createClerkAccountStatusReader} from '@profitia/platform-contracts/identity-provider'
import {OPERATION_CONTRACT,OperationDenied,operationPayloadDigest} from '@profitia/platform-contracts/operation-context'
import {externalCallFailureEvidence} from '@profitia/platform-contracts/external-call'
import {createSrmNativePgDriver} from './native-pg-driver'
import type {SupplierNativeWorkOptions,SupplierNativeWorkSelection} from './supplier-request-work'
import type {createSrmSupplierSourceRequest} from './supplier-source-request'
import {createSrmProviderSourceTransport,guardOriginalProviderCall} from './provider-source-transport'
import {fetchCeidgJdg,type CeidgResult} from './integrations/ceidg'
import {readSupplierRequest} from './supplier-request-operation'

export type CompanyClassification='JDG'|'NOT_JDG'|'UNAVAILABLE'
const refuse=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
/** A classification is never a public JDG/person DTO or proof that an outage
 * means company. Existing JDG disclosure keeps its own current private host. */
export function classifyCeidgResult(nip:string,result:CeidgResult):CompanyClassification{
 readSupplierRequest({kind:'SUPPLIER_REPORT',nip})
 if(result.section.source.provider!=='CEIDG'||result.errorCode)return 'UNAVAILABLE'
 const entries=result.section.data?.entries
 if(result.section.status==='SUCCESS'&&entries?.length&&entries.every(e=>e.nip===nip))return 'JDG'
 if(result.section.status==='EMPTY'&&result.section.data===null)return 'NOT_JDG'
 return 'UNAVAILABLE'
}

/** Uses the already committed report command and canonical delegated Source
 * admission. No private JDG request, person publication, supplier snapshot or
 * additional customer command is created merely to select the company path. */
export function createSrmCompanyClassifier(options:Readonly<{
 work:SupplierNativeWorkOptions;source:ReturnType<typeof createSrmSupplierSourceRequest>;
 provider:Omit<Parameters<typeof createSrmProviderSourceTransport>[0],'provider'|'providerOrigin'|'nip'|'operationKey'|'headers'>;
 apiKey:string;
}>){
 const {work,source,provider}=options
 if(work.privateAcquisition||work.reportAdmission||work.job.targetOperation!=='supplier.report.refresh'
  ||!options.apiKey?.trim()||provider.application.appId!=='srm-provider-source')return refuse()
 const deliveryOptions={application:work.application,binding:work.binding,job:work.job,
  sourceDelivery:source.port,now:work.now,transactionTimeoutMs:work.transactionTimeoutMs,
  readExternalAccount:createClerkAccountStatusReader({client:work.clerk,...work.accountIdentity,now:work.now}),
  ...createSrmNativePgDriver(work.pool,work.auditPool)}
 const dispatch=createDelegatedJobHost<PoolClient>(deliveryOptions)
 const operation=(input:SupplierNativeWorkSelection)=>({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
  operation:'job.execute' as const,organisationId:input.organisationId,resourceId:input.requestId,
  payload:readSupplierRequest(input.command),request:null})
 const deliverRootClaim=async(input:SupplierNativeWorkSelection,signal:AbortSignal,rootClaim:CommittedRootClaim):Promise<void>=>{
  signal.throwIfAborted()
  const result=await createRootAtomicClaimDeliveryHost<PoolClient>(deliveryOptions).deliver(operation(input),rootClaim)
  signal.throwIfAborted()
  if(result.value.status!=='CONFIRMED')throw new OperationDenied('DELIVERY_UNCERTAIN')
 }
 return Object.freeze({deliverRootClaim,async classify(input:SupplierNativeWorkSelection,signal:AbortSignal,rootClaim?:CommittedRootClaim|null):Promise<CompanyClassification>{
  const command=readSupplierRequest(input.command)
  signal.throwIfAborted()
  if(rootClaim!==undefined&&rootClaim!==null)await deliverRootClaim(input,signal,rootClaim)
  else{
   // A canonical replay has no new Root claim. Keep its original admission,
   // lease and Source reconciliation path; a refused proof never falls back.
   const selected=operation(input)
   let admission=(await dispatch.admit(selected)).value
   if(admission.status==='READY')admission=(await dispatch.deliver!(selected,admission)).value
   if(admission.status!=='CONFIRMED')throw new OperationDenied('DELIVERY_UNCERTAIN')
  }
  signal.throwIfAborted()
  const transport=createSrmProviderSourceTransport({...provider,provider:'CEIDG',providerOrigin:'https://dane.biznes.gov.pl',nip:command.nip,
   operationKey:operationPayloadDigest({version:'srm-company-classification-v1',requestId:input.requestId,nip:command.nip}),
   headers:{authorization:'Bearer '+options.apiKey.trim(),accept:'application/json'}})
  let result:CeidgResult
  try{result=await guardOriginalProviderCall(transport.fetcher,fetcher=>fetchCeidgJdg(command.nip,{token:options.apiKey,fetcher,
   url:'https://dane.biznes.gov.pl/api/ceidg/v3/firma'}))}
  catch(error){
   signal.throwIfAborted()
   const failure=externalCallFailureEvidence(error)
   // A refused redirect is provider unavailability only after the original
   // Source host confirms current authority and commits its failed attempt.
   // No redirect is followed and no JDG/company identity is inferred here.
   if(failure?.sourceId==='srm.provider.ceidg'&&failure.resourceId==='srm-provider:ceidg'
    &&failure.applicationId===provider.application.appId&&failure.environment===provider.application.environment
    &&[301,302,303,307,308].includes(failure.httpStatus))return 'UNAVAILABLE'
   throw error
  }
  signal.throwIfAborted()
  return classifyCeidgResult(command.nip,result)
 }})
}
