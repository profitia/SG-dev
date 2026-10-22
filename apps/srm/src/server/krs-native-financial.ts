import type {VerifiedIdentityV1} from '@profitia/krs-registry-contracts'
import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import type {XrayCompanyPorts} from './xray-lookup'
import type {SupplierNativeWorkSelection} from './supplier-request-work'
import type {MgbiFinancialResult} from './mgbi-financial'
import {reconcileKrsFinancial} from './krs-financial'
import {applyFinancialDocumentMetadata} from './financial-documents'
import {emptyCard} from '../demo/fixture'

// This composition has no General acquisition port. All effects use the same
// original native Request/Source/Work/archive/MSR/Financial helpers as NIP mode.
type Ports=Pick<XrayCompanyPorts,'createLookup'|'fetchMgbiFinancial'|'saveMgbiArchive'|'saveFinancialDocuments'|
 'readFinancialDocuments'|'enrichMsrFinancial'|'persistSection'|'saveSharedCompany'|'refreshFinancialIndicators'|'recordInterest'>
export async function prepareKrsFinancialWork(ports:Ports,selection:SupplierNativeWorkSelection,identity:VerifiedIdentityV1,
 recheck:()=>Promise<void>,now:()=>number=Date.now){
 const {validateIdentityEvidence}=await import('@profitia/krs-registry-contracts')
 const deny=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
 const check=async()=>{const current=await validateIdentityEvidence(identity,now());
  if(current.status!=='VERIFIED'||current.identity.nip!==selection.command.nip)return deny();await recheck()}
 await check()
 const org=selection.organisationId,nip=selection.command.nip
 const lookup=await ports.createLookup(org,{type:'NIP',value:nip},'COMPANY')
 if(lookup.requestId!==selection.requestId)return deny()
 await check()
 let result=await reconcileKrsFinancial(identity,await ports.fetchMgbiFinancial({type:'NIP',value:nip}),now())
 await check()
 if(result.rawResponse&&!result.errorCode&&result.section.retrievedAt){
  await ports.saveMgbiArchive(org,nip,'pl-krs-rdf-record',result.rawResponse.pages,result.rawResponse.recordCount,result.section.retrievedAt,selection.requestId)
  await ports.saveFinancialDocuments(org,nip,result.rawResponse.pages)
  await check()
  result=await ports.enrichMsrFinancial(org,nip,result,{requestId:selection.requestId,allowedKrs:[identity.selectedKrs]})
  await check()
  result=await reconcileKrsFinancial(identity,result,now())
  if(result.section.data){
   const documents=await ports.readFinancialDocuments(org,nip)
   result.section=applyFinancialDocumentMetadata(result.section,documents)
   if(result.sourceData)result.sourceData=applyFinancialDocumentMetadata({...result.section,data:result.sourceData},documents).data??undefined
  }
 }
 const accepted=result
 let published=false
 return Object.freeze({result:accepted,async publish(eligible:MgbiFinancialResult){
  await check()
  if(published||eligible.errorCode||JSON.stringify(eligible.rawResponse)!==JSON.stringify(accepted.rawResponse)
   ||JSON.stringify(eligible.facts)!==JSON.stringify(accepted.facts))return deny()
  const audited=await reconcileKrsFinancial(identity,accepted,now())
  if(audited.errorCode||JSON.stringify(audited.section)!==JSON.stringify(eligible.section))return deny()
  const snapshotId=await ports.persistSection(org,lookup,'financial',eligible.section,eligible.errorCode,eligible.facts,undefined,eligible.sourceData)
  await check()
  await ports.saveSharedCompany(org,nip,{general:emptyCard.general,financial:eligible.section,
   generalSnapshotId:null,financialSnapshotId:snapshotId,facts:eligible.facts,preserveGeneral:true})
  await check();await ports.recordInterest(org,nip);published=true
 }})
}
