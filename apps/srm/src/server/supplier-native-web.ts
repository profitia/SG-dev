import {operationPayloadDigest,OperationDenied,type Json} from '@profitia/platform-contracts/operation-context'
import {createSrmSupplierNativeWork,type SupplierNativeWorkOptions,type SupplierNativeWorkSelection} from './supplier-request-work'
import {createSrmPublicWebSourceTransport} from './provider-source-transport'
import {bindOrganizationTransaction} from './db'
import {readWebSubject,claimWebIdentity,saveWebIdentity,subjectHash,type Claim} from './supplier-web-store'
import {discoverWebsite,type WebSubject} from './website-discovery'

type Options=Readonly<{work:SupplierNativeWorkOptions;source:Omit<Parameters<typeof createSrmPublicWebSourceTransport>[0],'operationKey'>;entityType:'COMPANY'|'JDG'}>
const refuse=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
/** The original reader, cache writer, discovery, identity matcher and image
 * conversion are unchanged. No SQL transaction remains open during HTTP. */
export function createSrmNativeWebLookup(options:Options){
 const {entityType}=options,target=options.work.privateAcquisition
 if(typeof window!=='undefined'||!['COMPANY','JDG'].includes(entityType)||target?.section!=='web'
  ||target.entityType!==entityType||!target.webBoundaryDigest
  ||options.work.workBusinessBoundaryDigest!==target.webBoundaryDigest
  ||options.work.application.environment!==options.source.application.environment)return refuse()
 const work=createSrmSupplierNativeWork(options.work)
 return Object.freeze({async run(selected:SupplierNativeWorkSelection,signal?:AbortSignal):Promise<'AVAILABLE'|'NOT_FOUND'|'PENDING'>{
  signal?.throwIfAborted()
  let subject:WebSubject|null=null
  await work.run(selected,'SRM_WEB_SUBJECT_READ',{entityType},async(context,client)=>{
   subject=await readWebSubject(selected.organisationId,selected.command.nip,entityType,bindOrganizationTransaction(selected.organisationId,client,context))
  })
  if(!subject)return 'NOT_FOUND'
  const captured=structuredClone(subject as WebSubject),identityHash=subjectHash(captured)
  let claim:Claim|undefined
  await work.run(selected,'SRM_WEB_CLAIM',{entityType,identityHash},async(context,client)=>{
   claim=await claimWebIdentity(selected.organisationId,selected.command.nip,entityType,identityHash,bindOrganizationTransaction(selected.organisationId,client,context))
  })
  if(!claim)return refuse()
  const accepted=claim as Claim
  if(accepted.kind==='CACHED')return 'AVAILABLE'
  if(accepted.kind==='PENDING')return 'PENDING'
  signal?.throwIfAborted()
  const source=createSrmPublicWebSourceTransport({...options.source,
   operationKey:operationPayloadDigest({version:'srm-private-website-v1',requestId:selected.requestId})})
  const data={...await discoverWebsite(captured,(url,args={})=>source.fetcher(url,{...args,
   signal:signal?AbortSignal.any([signal,...(args.signal?[args.signal]:[])]):args.signal})),checkedAt:new Date().toISOString()}
  source.assertSettled();signal?.throwIfAborted()
  await work.run(selected,'SRM_WEB_SAVE',{entityType,identityHash,token:accepted.token,resultDigest:operationPayloadDigest(data as Json)},async(context,client)=>{
   await saveWebIdentity(selected.organisationId,selected.command.nip,entityType,identityHash,accepted.token,data,
    bindOrganizationTransaction(selected.organisationId,client,context))
  })
  return 'AVAILABLE'
 }})
}
