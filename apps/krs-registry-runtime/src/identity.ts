import {identityDigest,validateIdentityEvidence,canonical,sha256,nip,regon,krs,acceptedNormalizerVersion} from '@profitia/krs-registry-contracts'
import type {CompanySnapshot,SelectedKrsIdentityEvidenceV1,VerifiedIdentityV1,IdentityBlockCodeV1,BlockedIdentityV1} from '@profitia/krs-registry-contracts'
export interface IdentityCatalog {
  read(krs:string,register?:'P'|'S'):Promise<CompanySnapshot|null>
  byNip(nip:string):Promise<string[]>
  accepted(ref:string):Promise<CompanySnapshot|null>
}
export function blocked(selected:unknown,code:IdentityBlockCodeV1,candidates:string[]=[],snapshot:CompanySnapshot|null=null):BlockedIdentityV1{
  return {contract:'profitia.krs-company-identity',version:'1.0.0',status:'BLOCKED',selectedKrs:krs(selected)?selected:null,identity:null,code,candidateKrs:[...new Set(candidates.filter(krs))].sort().slice(0,100),generalSnapshotRef:snapshot?.evidenceRef??null,sourceEvidenceRef:snapshot?.evidenceRef??null,retryAfter:null}
}
export function compatible(a:CompanySnapshot,b:CompanySnapshot):boolean{
  return a.canonicalKrs===b.canonicalKrs&&a.nip!==null&&a.nip===b.nip&&a.regon===b.regon
}
/** Catalog mappings are candidates; no mapper or name match grants identity. No MGBI is present in this runtime. */
export async function resolveIdentity(input:{selectedKrs?:unknown;nip?:unknown;regon?:unknown},catalog:IdentityCatalog,now=Date.now()):Promise<SelectedKrsIdentityEvidenceV1>{
  let selected=input.selectedKrs
  if(selected!==undefined&&!krs(selected))return blocked(null,'INVALID_KRS')
  if(input.nip!==undefined&&!nip(input.nip))return blocked(selected,'INVALID_NIP')
  if(input.regon!==undefined&&!regon(input.regon))return blocked(selected,'INVALID_REGON')
  if(!krs(selected)){
    if(!nip(input.nip))return blocked(null,'MISSING_NIP')
    const candidates=[...new Set(await catalog.byNip(input.nip))]
    if(candidates.length>1)return blocked(null,'AMBIGUOUS_COMPANY',candidates)
    if(candidates.length!==1)return blocked(null,'KRS_UNAVAILABLE')
    selected=candidates[0]
  }
  if(!krs(selected))return blocked(null,'INVALID_KRS')
  const p=await catalog.read(selected,'P'),s=await catalog.read(selected,'S'),snapshot=p??s
  if(!snapshot)return blocked(selected,'KRS_UNAVAILABLE')
  if(p&&s&&!compatible(p,s))return blocked(selected,'IDENTIFIER_CONFLICT',[],snapshot)
  if(snapshot.canonicalKrs!==selected||snapshot.source.sourceRecordId!==selected||snapshot.entityKey!=='PL:KRS:'+selected||snapshot.warnings.some(w=>w.startsWith('CONFLICTING_')))return blocked(selected,'IDENTIFIER_CONFLICT',[],snapshot)
  if(snapshot.source.extract!=='CURRENT'||snapshot.state==='REMOVED')return blocked(selected,'UNCONFIRMED_HISTORICAL_KRS',[],snapshot)
  if(snapshot.nip===null)return blocked(selected,'MISSING_NIP',[],snapshot)
  if(!nip(snapshot.nip))return blocked(selected,'INVALID_NIP',[],snapshot)
  if(snapshot.regon!==null&&!regon(snapshot.regon))return blocked(selected,'INVALID_REGON',[],snapshot)
  if((input.nip!==undefined&&input.nip!==snapshot.nip)||(input.regon!==undefined&&input.regon!==snapshot.regon))return blocked(selected,'IDENTIFIER_CONFLICT',[],snapshot)
  if(!snapshot.officialName)return blocked(selected,'KRS_UNAVAILABLE',[],snapshot)
  if(!acceptedNormalizerVersion(snapshot.source.normalizerVersion))return blocked(selected,'UNSUPPORTED_EVIDENCE_VERSION',[],snapshot)
  const value:VerifiedIdentityV1={contract:'profitia.krs-company-identity',version:'1.0.0',status:'VERIFIED',selectedKrs:selected,identity:{entityKey:snapshot.entityKey,krs:selected,nip:snapshot.nip,regon:snapshot.regon,officialName:snapshot.officialName},source:{...snapshot.source,extract:'CURRENT',checkedAt:new Date(now).toISOString()},validity:{policy:'KRS_FINANCIAL_IDENTITY_FRESHNESS_V1',maxAgeSeconds:300,maxClockSkewSeconds:30,expiresAt:new Date(Date.parse(snapshot.source.retrievedAt)+300000).toISOString()},evidenceRef:snapshot.evidenceRef,evidenceDigest:'0'.repeat(64),historicalCandidates:snapshot.historicalCandidates}
  value.evidenceDigest=await identityDigest(value)
  try{await validateIdentityEvidence(value,now);return value}catch{return blocked(selected,'STALE_IDENTITY_EVIDENCE',[],snapshot)}
}
/** Called at the eventual consumer boundary, in addition to its current E1 admission. Hash is never authority. */
export async function revalidateAcceptedIdentity(input:unknown,selectedKrs:string,catalog:IdentityCatalog,now:number):Promise<VerifiedIdentityV1>{
  const v=await validateIdentityEvidence(input,now)
  if(v.status!=='VERIFIED'||v.selectedKrs!==selectedKrs)throw Error('IDENTIFIER_CONFLICT')
  const accepted=await catalog.accepted(v.evidenceRef),current=await catalog.read(selectedKrs,v.source.register)
  if(!accepted||!current||current.evidenceRef!==v.evidenceRef)throw Error('STALE_IDENTITY_EVIDENCE')
  const rebuilt=await resolveIdentity({selectedKrs,nip:v.identity.nip,...(v.identity.regon?{regon:v.identity.regon}:{})},catalog,Date.parse(v.source.checkedAt))
  if(rebuilt.status!=='VERIFIED'||rebuilt.evidenceDigest!==v.evidenceDigest||accepted.source.rawDigest!==v.source.rawDigest||accepted.source.contentDigest!==v.source.contentDigest)throw Error('FORGED_SOURCE_EVIDENCE')
  // Defense against an accepted JSON payload drifting away from its allowlisted business facts.
  const {contract,version,source,evidenceRef,...facts}=accepted
  if(await sha256(canonical(facts))!==source.contentDigest)throw Error('FORGED_SOURCE_EVIDENCE')
  return v
}
