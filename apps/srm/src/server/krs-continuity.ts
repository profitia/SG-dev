import type {VerifiedIdentityV1} from '@profitia/krs-registry-contracts'
import {resolveCompanyRecords,type RegistryHistory} from './company-continuity'
export type KrsContinuityResult=Readonly<{history:RegistryHistory;warnings?:readonly string[]}>
/** Adapt genuine settled official extracts to the existing KRS_CONTINUITY_V1 resolver.
 * No MGBI General acquisition, name matching, client history or new identity engine. */
export async function krsContinuity(evidence:unknown,identity:VerifiedIdentityV1,now:number):Promise<KrsContinuityResult>{
 const {nativeContinuityEvidence}=await import('@profitia/krs-registry-runtime/native')
 const {validateIdentityEvidence,validateCompanySnapshot}=await import('@profitia/krs-registry-contracts')
 const deny=():never=>{throw Error('KRS_CONTINUITY_UNVERIFIED')}
 if(!nativeContinuityEvidence(evidence))return deny()
 const current=await validateIdentityEvidence(identity,now)
 if(current.status!=='VERIFIED'||evidence.currentEvidenceRef!==current.evidenceRef)return deny()
 const records=[]
 for(const value of evidence.records){
  const s=await validateCompanySnapshot(value.snapshot)
  const nips=[...new Set(s.identifiers.filter(v=>v.kind==='NIP').map(v=>v.value))]
  const regons=[...new Set(s.identifiers.filter(v=>v.kind==='REGON').map(v=>v.value))]
  if(nips.length!==1||nips[0]!==current.identity.nip||s.identifiers.some(v=>v.kind==='NIP'&&!v.valid)||regons.length>1)return deny()
  if(s.canonicalKrs===current.selectedKrs&&(s.evidenceRef!==current.evidenceRef||s.source.rawDigest!==current.source.rawDigest))return deny()
  records.push({id:s.evidenceRef,identifiers:{pl_krs:s.canonicalKrs,pl_nip:nips[0],pl_regon:regons[0]??null},
   content:{[s.source.extract==='CURRENT'?'current_excerpt':'full_excerpt']:value.excerpt}})
 }
 const resolved=resolveCompanyRecords(records,{type:'NIP',value:current.identity.nip})
 if(resolved.error||resolved.history.currentKrs!==current.selectedKrs||resolved.history.unlinkedKrs.length||resolved.history.members.length!==records.length)return deny()
 return {history:resolved.history,warnings:evidence.excluded.length?['KRS_HISTORY_INCOMPLETE_MISSING_PREDECESSOR_NIP']:[]}
}
