import type {GeneralCompanyData,SectionEnvelope} from '@profitia/srm-xray'
import type {VerifiedIdentityV1} from '@profitia/krs-registry-contracts'
import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import type {XrayCompanyPorts} from './xray-lookup'
import type {SupplierNativeWorkSelection} from './supplier-request-work'
import type {MgbiFinancialResult} from './mgbi-financial'
import {reconcileKrsFinancial} from './krs-financial'
import {applyFinancialDocumentMetadata} from './financial-documents'
import {isFreshCatalogEntry} from './shared-catalog'
import {unrequestedCorporateGeneral} from './corporate-source-store'

// This composition has no General acquisition port. All effects use the same
// original native Request/Source/Work/archive/MSR/Financial helpers as NIP mode.
type Ports=Pick<XrayCompanyPorts,'createLookup'|'fetchMgbiFinancial'|'saveMgbiArchive'|'saveFinancialDocuments'|
 'readFinancialDocuments'|'enrichMsrFinancial'|'persistSection'|'saveSharedCompany'|'refreshFinancialIndicators'|'recordInterest'|'reprojectFinancialArchive'>
export type KrsFinancialRecheck=(boundary?:'ACQUISITION'|'PUBLICATION')=>Promise<void>
export async function prepareKrsFinancialWork(ports:Ports,selection:SupplierNativeWorkSelection,identity:VerifiedIdentityV1,
 recheck:KrsFinancialRecheck,now:()=>number=Date.now,general?:SectionEnvelope<GeneralCompanyData>){
 const {validateIdentityEvidence}=await import('@profitia/krs-registry-contracts')
 const deny=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
 const check=async(boundary?:Parameters<KrsFinancialRecheck>[0])=>{const current=await validateIdentityEvidence(identity,now());
  if(current.status!=='VERIFIED'||current.identity.nip!==selection.command.nip)return deny();await recheck(boundary)}
 await check()
 const org=selection.organisationId,nip=selection.command.nip
 const lookup=await ports.createLookup(org,{type:'NIP',value:nip},'COMPANY')
 if(lookup.requestId!==selection.requestId)return deny()
 await check()
 if(general){
  if(general.source.provider!=='KRS'||general.data?.nip!==identity.identity.nip||general.data.krs!==identity.selectedKrs)return deny()
  await ports.persistSection(org,lookup,'general',general,null,[])
  await check()
 }
 const history=general?.data?.registryHistory
 const restored=await ports.reprojectFinancialArchive(org,nip,history,undefined,true)
 const cached=restored&&isFreshCatalogEntry(restored.section.retrievedAt,new Date(now()))?restored:null
 let result=await reconcileKrsFinancial(identity,cached??await ports.fetchMgbiFinancial({type:'NIP',value:nip},{companyHistory:history}),now(),history)
 // Fresh HUMAN authority after a new provider acquisition, before its archive.
 await check(cached?undefined:'ACQUISITION')
 let pending=false
 if(result.rawResponse&&!result.errorCode&&result.section.retrievedAt){
  if(!cached){
  await ports.saveMgbiArchive(org,nip,'pl-krs-rdf-record',result.rawResponse.pages,result.rawResponse.recordCount,result.section.retrievedAt,selection.requestId)
  await ports.saveFinancialDocuments(org,nip,result.rawResponse.pages)
  await check()
  // The funded inventory is durable before a new browser request continues
  // licensed originals with a fresh session token. Never buy the inventory twice.
  pending=true
  }else{
  result=await ports.enrichMsrFinancial(org,nip,result,{requestId:selection.requestId,allowedKrs:history?.members.map(m=>m.krs)??[identity.selectedKrs],maximumNewDownloads:1})
  // MSR may have acquired a licensed original; recheck before publication.
  await check('ACQUISITION')
  result=await reconcileKrsFinancial(identity,result,now(),history)
  pending=result.section.warnings.includes('MSR_PROCESSING_PENDING')&&!result.section.warnings.some(w=>['MSR_BUDGET_UNAVAILABLE','MSR_FILE_BUDGET_EXHAUSTED','MSR_PROVIDER_NOT_CONFIGURED'].includes(w))
  if(result.section.data){
   const documents=await ports.readFinancialDocuments(org,nip)
   result.section=applyFinancialDocumentMetadata(result.section,documents,history)
   if(result.sourceData)result.sourceData=applyFinancialDocumentMetadata({...result.section,data:result.sourceData},documents,history).data??undefined
  }
  }
 }
 const accepted=result
 let published=false
 return Object.freeze({result:accepted,pending,async publish(eligible:MgbiFinancialResult){
  await check('PUBLICATION')
  if(pending||published||eligible.errorCode||JSON.stringify(eligible.rawResponse)!==JSON.stringify(accepted.rawResponse)
   ||JSON.stringify(eligible.facts)!==JSON.stringify(accepted.facts))return deny()
  const audited=await reconcileKrsFinancial(identity,accepted,now(),history)
  if(audited.errorCode||JSON.stringify(audited.section)!==JSON.stringify(eligible.section))return deny()
  const snapshotId=await ports.persistSection(org,lookup,'financial',eligible.section,eligible.errorCode,eligible.facts,undefined,eligible.sourceData,cached?'CACHE':'PROVIDER')
  await check()
  await ports.saveSharedCompany(org,nip,{general:unrequestedCorporateGeneral(),financial:eligible.section,
   generalSnapshotId:null,financialSnapshotId:snapshotId,facts:eligible.facts,preserveGeneral:true})
  await check();await ports.recordInterest(org,nip);published=true
 }})
}
