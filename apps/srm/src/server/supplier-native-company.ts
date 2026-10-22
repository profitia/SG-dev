import { createHash } from 'node:crypto'
import { ExternalCallUnavailable } from '@profitia/platform-contracts/external-call'
import { platformDeliveryEvidence } from '@profitia/platform-contracts/platform-ingestion'
import { OperationDenied, isOperationDenied, operationPayloadDigest } from '@profitia/platform-contracts/operation-context'
import { createSrmSupplierNativeWork, type SupplierNativeWorkOptions, type SupplierNativeWorkSelection } from './supplier-request-work'
import { createSrmSupplierNativeWorkStore } from './supplier-native-work-store'
import { createSrmSupplierSourceLink } from './supplier-source-link'
import {prepareKrsFinancialWork} from './krs-native-financial'
import type {VerifiedIdentityV1} from '@profitia/krs-registry-contracts'
import type { createSrmSupplierSourceRequest } from './supplier-source-request'
import { createSrmProviderSourceTransport, createSrmMsrSourceTransport, guardOriginalProviderCall as originalCall } from './provider-source-transport'
import { createSrmCorporateSourceStore, CORPORATE_PUBLICATION_VERSION, readCorporatePacket } from './corporate-source-store'
import { projectPublicFinancialData } from './corporate-knowledge'
import { createXrayCompanyLookup, type XrayCompanyPorts } from './xray-lookup'
import { fetchMgbiGeneral } from './mgbi-general'
import { fetchMgbiFinancial } from './mgbi-financial'
import { downloadMsrOriginal, MsrSourceError } from './msr-source'
import { enrichMsrFinancial } from './msr-repository'
import { providerExceptionCode } from './lookup-diagnostics'
import { readSupplierRequest } from './supplier-request-operation'

type ProviderOptions=Omit<Parameters<typeof createSrmProviderSourceTransport>[0],
  'provider'|'providerOrigin'|'nip'|'operationKey'|'headers'>
type Options={work:SupplierNativeWorkOptions;namedInterestBoundaryDigest:string;
  source:ReturnType<typeof createSrmSupplierSourceRequest>;
  corporate:Parameters<typeof createSrmCorporateSourceStore>[0];
  mgbi:{apiKey:string;authScheme:'raw'|'bearer';source:ProviderOptions;
    msrExternal:ProviderOptions['external'];syntheticStorageOrigin?:string}}
const refuse=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex')

/** Full original company engine; private purposes, Source HTTP and classified
 * publication use their existing independent native hosts. No HTTP activation,
 * caller-selected identity, alternate writer or network inside SQL is added. */
export function createSrmNativeCompanyLookup(options:Options){
  if(typeof window!=='undefined'||!options||Object.keys(options).sort().join(',')!=='corporate,mgbi,namedInterestBoundaryDigest,source,work'
    ||typeof options.mgbi?.apiKey!=='string'||!options.mgbi.apiKey.trim()
    ||!['raw','bearer'].includes(options.mgbi.authScheme)
    ||options.work.application.environment!==options.mgbi.source.application.environment
    ||options.work.application.environment!==options.corporate.application.environment)return refuse()
  const admittedSource=platformDeliveryEvidence(options.source?.port)
  const sourceFields=['applicationId','environment','projectId','branchId','databaseName','schemaDigest'] as const
  if(!admittedSource||sourceFields.some(key=>options.mgbi.source.binding[key]!==admittedSource[key]))return refuse()
  const work=createSrmSupplierNativeWork(options.work)
  const store=createSrmSupplierNativeWorkStore({work,namedInterestBoundaryDigest:options.namedInterestBoundaryDigest})
  const link=createSrmSupplierSourceLink({work:options.work,namedInterestBoundaryDigest:options.namedInterestBoundaryDigest,source:options.source})
  const corporate=createSrmCorporateSourceStore(options.corporate)
  const {pool,auditPool,now}=options.mgbi.source
  const fixed=structuredClone({application:options.mgbi.source.application,binding:options.mgbi.source.binding,
    external:options.mgbi.source.external,msrExternal:options.mgbi.msrExternal,
    syntheticOrigin:options.mgbi.source.syntheticOrigin,syntheticStorageOrigin:options.mgbi.syntheticStorageOrigin})
  const apiKey=options.mgbi.apiKey.trim(),authScheme=options.mgbi.authScheme
  const headers={authorization:authScheme==='bearer'?'Bearer '+apiKey:apiKey,accept:'application/json'}
  const clock=now?()=>new Date(now()):()=>new Date()
  async function execute<T>(input:SupplierNativeWorkSelection,engine:(ports:XrayCompanyPorts)=>Promise<T>,recheck?:()=>Promise<void>,keepExistingSupplier=false){
    if(!input||Object.getPrototypeOf(input)!==Object.prototype||Reflect.ownKeys(input).length!==3
      ||Object.keys(input).sort().join(',')!=='command,organisationId,requestId'
      ||Object.values(Object.getOwnPropertyDescriptors(input)).some(d=>!('value'in d)||!d.enumerable))return refuse()
    const selection=Object.freeze({...input,command:Object.freeze(readSupplierRequest(input.command))})
    let operationKey:string|undefined,lookup:Readonly<{supplierId:string;requestId:string}>|undefined
    let mgbi:ReturnType<typeof createSrmProviderSourceTransport>|undefined
    const scope=(org:string,nip:string)=>{if(org!==selection.organisationId||nip!==selection.command.nip||!lookup||!operationKey)return refuse()}
    const sourceOptions=()=>({application:fixed.application,binding:fixed.binding,pool,auditPool,now,
      external:fixed.external,syntheticOrigin:fixed.syntheticOrigin,headers,nip:selection.command.nip,
      operationKey:operationKey??refuse()})
    const transport=()=>mgbi??=createSrmProviderSourceTransport({...sourceOptions(),provider:'MGBI',providerOrigin:'https://api.mgbi.pl'})
    const clientOptions=(fetcher:typeof fetch)=>({apiKey,authScheme,fetcher,baseUrl:'https://api.mgbi.pl',now:clock})
    const ports:XrayCompanyPorts={
      createLookup:async(org,identifier)=>{
        if(lookup||org!==selection.organisationId||identifier.type!=='NIP'||identifier.value!==selection.command.nip)return refuse()
        const admitted=await link.registerAndAdmit(selection,keepExistingSupplier?'KEEP':'TOUCH')
        if(admitted.sourceStatus!=='CONFIRMED'||!admitted.sourceRequest)throw new OperationDenied('DELIVERY_UNCERTAIN')
        if(admitted.lookup.requestId!==selection.requestId)return refuse()
        lookup=Object.freeze(admitted.lookup)
        operationKey=operationPayloadDigest({version:'srm-native-company-v1',sourceEffectId:admitted.sourceRequest.effectId,nip:selection.command.nip})
        return lookup
      },
      readFreshCompany:async(org,nip,at)=>{scope(org,nip);return store.cache(selection,at??clock())},
      readCompanyRegistration:async(org,nip)=>{scope(org,nip);return store.registration(selection)},
      enrichCompanyPkd:async(org,nip,section)=>{scope(org,nip);return store.pkd(selection,section)},
      reprojectFinancialArchive:async(org,nip,history,callerPool,includeOriginalResponse)=>{scope(org,nip);if(callerPool!==undefined)return refuse();return store.reproject(selection,history,includeOriginalResponse)},
      fetchMgbiGeneral:async identifier=>{
        scope(selection.organisationId,identifier.value);if(identifier.type!=='NIP')return refuse()
        return originalCall(transport().fetcher,fetcher=>fetchMgbiGeneral(identifier,clientOptions(fetcher)))
      },
      fetchMgbiFinancial:async(identifier,metadata)=>{
        scope(selection.organisationId,identifier.value);if(identifier.type!=='NIP')return refuse()
        await recheck?.()
        return originalCall(transport().fetcher,fetcher=>fetchMgbiFinancial(identifier,{...clientOptions(fetcher),companyHistory:metadata?.companyHistory}))
      },
      saveMgbiArchive:async(org,nip,model,pages,count,at,requestId)=>{
        scope(org,nip);if(requestId!==selection.requestId)return refuse()
        return store.archive(selection,model,pages,count,at)
      },
      saveFinancialDocuments:async(org,nip,pages)=>{scope(org,nip);return store.prepareDocuments(selection,pages)},
      readFinancialDocuments:async(org,nip)=>{scope(org,nip);return store.restoreDocuments(selection)},
      enrichMsrFinancial:async(org,nip,base,metadata)=>{
        scope(org,nip);if(metadata?.requestId!==selection.requestId||metadata.store||metadata.download||metadata.parse)return refuse()
        return enrichMsrFinancial(org,nip,base,{...metadata,store:store.msr(selection,metadata.allowedKrs),download:async recordId=>{
          await recheck?.()
          const source=createSrmMsrSourceTransport({...sourceOptions(),external:fixed.msrExternal,recordId,
            operationKey:hash(operationKey+':msr:'+recordId),syntheticStorageOrigin:fixed.syntheticStorageOrigin})
          try{return await originalCall(source.fetcher,fetcher=>downloadMsrOriginal(recordId,{apiKey,authScheme,fetcher,now:clock}))}
          catch(error){
            // Reuse the original MSR deferral/block writer. A proven unsent
            // call can wait for budget; an uncertain purchase cannot retry.
            if(error instanceof ExternalCallUnavailable)throw new MsrSourceError(error.certainty==='NOT_SENT'?'MSR_BUDGET_UNAVAILABLE':'MSR_DOWNLOAD_RECONCILIATION_REQUIRED','native_source')
            throw error
          }
        }})
      },
      persistSection:async(org,actual,section,envelope,errorCode,facts,correlation,sourceData,method)=>{
        scope(org,selection.command.nip)
        if(actual.requestId!==lookup!.requestId||actual.supplierId!==lookup!.supplierId||!['general','financial'].includes(section)
          ||envelope.source.provider!=='MGBI')return refuse()
        // The legacy port also accepts KYS; this closed original company
        // engine supplies only its MGBI general/financial sections.
        return store.section(selection,section as 'general'|'financial',envelope as Parameters<typeof store.section>[2],errorCode,facts,correlation,
          section==='financial'?sourceData as Parameters<typeof store.section>[6]:undefined,method)
      },
      saveSharedCompany:async(org,nip,value)=>{
        scope(org,nip)
        const section=<T extends typeof value.general|typeof value.financial>(v:T)=>({status:v.status,source:v.source,
          retrievedAt:v.retrievedAt,effectiveAt:v.effectiveAt,warnings:v.warnings,data:v.data})
        const packet=readCorporatePacket({version:CORPORATE_PUBLICATION_VERSION,nip,preserveGeneral:value.preserveGeneral??false,
          general:section(value.general),financial:{...section(value.financial),data:projectPublicFinancialData(value.financial.data)},facts:value.facts})
        // Shared publication is content-addressed under this real admitted
        // Source request. Private lookup/snapshot/organisation IDs are absent.
        await corporate.publish(packet,hash(operationKey+':corporate:'+JSON.stringify(packet)))
      },
      refreshFinancialIndicators:async(org,nip,data)=>{scope(org,nip);return store.indicators(selection,data)},
      recordInterest:async(org,nip)=>{scope(org,nip);await store.interest(selection)},
      recoverProviderException:error=>{
        if(isOperationDenied(error)||error instanceof ExternalCallUnavailable)throw error
        return providerExceptionCode(error)
      },
    }
    return engine(ports)
  }
  return Object.freeze({
    run:(selection:SupplierNativeWorkSelection)=>execute(selection,ports=>createXrayCompanyLookup(ports)(selection.organisationId,{identifier:{type:'NIP',value:selection.command.nip}})),
    prepareFinancial:(selection:SupplierNativeWorkSelection,identity:VerifiedIdentityV1,recheck:()=>Promise<void>)=>execute(selection,
      ports=>prepareKrsFinancialWork(ports,selection,identity,recheck,()=>clock().getTime()),recheck,true),
  })
}
