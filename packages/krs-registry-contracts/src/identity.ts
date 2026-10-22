import {canonical, sha256, closed, demand, text, krs, nip, regon, digest, instant, calendarDate, parseJson} from './validation.js'
export const IDENTITY_CONTRACT = Object.freeze({id:'profitia.krs-company-identity',version:'1.0.0'})
export const NORMALIZER_VERSION = 'krs-normalizer/1.0.1'
export const acceptedNormalizerVersion = (value:unknown):boolean => value === NORMALIZER_VERSION || value === 'krs-normalizer/1.0.0'
export type IdentityBlockCodeV1 = 'MISSING_NIP'|'INVALID_NIP'|'INVALID_KRS'|'INVALID_REGON'|'IDENTIFIER_CONFLICT'|'AMBIGUOUS_COMPANY'|'UNCONFIRMED_HISTORICAL_KRS'|'KRS_UNAVAILABLE'|'STALE_IDENTITY_EVIDENCE'|'UNSUPPORTED_EVIDENCE_VERSION'
export type IdentitySourceV1 = {
  provider:'KRS';register:'P'|'S';extract:'CURRENT';sourceRecordId:string;sourceVersion:string;normalizerVersion:string;
  rawDigest:string;contentDigest:string;sourceAsOfDate:string|null;entryNumber:number|null;retrievedAt:string;checkedAt:string;
}
export type HistoricalRegistrationCandidateV1 = {krs:string;relationship:'PREDECESSOR_CANDIDATE'|'SUCCESSOR_CANDIDATE';basis:'KRS_FORMATION_TRANSFORMATION';evidenceRefs:string[];evidenceDigest:string}
export type VerifiedIdentityV1 = {
  contract:'profitia.krs-company-identity';version:'1.0.0';status:'VERIFIED';selectedKrs:string;
  identity:{entityKey:string;krs:string;nip:string;regon:string|null;officialName:string};source:IdentitySourceV1;
  validity:{policy:'KRS_FINANCIAL_IDENTITY_FRESHNESS_V1';maxAgeSeconds:300;maxClockSkewSeconds:30;expiresAt:string};
  evidenceRef:string;evidenceDigest:string;historicalCandidates:HistoricalRegistrationCandidateV1[];
}
export type BlockedIdentityV1 = {
  contract:'profitia.krs-company-identity';version:'1.0.0';status:'BLOCKED';selectedKrs:string|null;identity:null;code:IdentityBlockCodeV1;
  candidateKrs:string[];generalSnapshotRef:string|null;sourceEvidenceRef:string|null;retryAfter:string|null;
}
export type SelectedKrsIdentityEvidenceV1 = VerifiedIdentityV1|BlockedIdentityV1
export const BLOCK_CODES: readonly IdentityBlockCodeV1[] = ['MISSING_NIP','INVALID_NIP','INVALID_KRS','INVALID_REGON','IDENTIFIER_CONFLICT','AMBIGUOUS_COMPANY','UNCONFIRMED_HISTORICAL_KRS','KRS_UNAVAILABLE','STALE_IDENTITY_EVIDENCE','UNSUPPORTED_EVIDENCE_VERSION']
export function identityCanonical(value: VerifiedIdentityV1): string {
  const {evidenceDigest:omitted,...rest} = value
  return canonical({...rest,historicalCandidates:rest.historicalCandidates.map(c=>({...c,evidenceRefs:[...new Set(c.evidenceRefs)].sort()})).sort((a,b)=>a.krs.localeCompare(b.krs)||a.relationship.localeCompare(b.relationship))})
}
export const identityDigest = (value: VerifiedIdentityV1) => sha256(identityCanonical(value))
export async function validateIdentityEvidence(input: unknown, now: number): Promise<SelectedKrsIdentityEvidenceV1> {
  demand(Number.isFinite(now),'TRUSTED_CLOCK_REQUIRED')
  const value = parseJson(typeof input === 'string' ? input : canonical(input))
  demand(new TextEncoder().encode(canonical(value)).length <= 65536,'OVERSIZED_JSON')
  const base = value as Partial<SelectedKrsIdentityEvidenceV1>
  demand(base?.contract === IDENTITY_CONTRACT.id && base.version === IDENTITY_CONTRACT.version,'UNSUPPORTED_EVIDENCE_VERSION')
  if (base.status === 'BLOCKED') {
    const v = closed(value,['contract','version','status','selectedKrs','identity','code','candidateKrs','generalSnapshotRef','sourceEvidenceRef','retryAfter'])
    demand((v.selectedKrs===null||krs(v.selectedKrs))&&v.identity===null&&BLOCK_CODES.includes(v.code as IdentityBlockCodeV1))
    demand(Array.isArray(v.candidateKrs)&&v.candidateKrs.length<=100&&v.candidateKrs.every(krs)&&new Set(v.candidateKrs).size===v.candidateKrs.length)
    demand((v.generalSnapshotRef===null||text(v.generalSnapshotRef))&&(v.sourceEvidenceRef===null||text(v.sourceEvidenceRef))&&(v.retryAfter===null||instant(v.retryAfter)))
    return v as unknown as BlockedIdentityV1
  }
  const v=closed(value,['contract','version','status','selectedKrs','identity','source','validity','evidenceRef','evidenceDigest','historicalCandidates'])
  demand(v.status==='VERIFIED'&&krs(v.selectedKrs))
  const id=closed(v.identity,['entityKey','krs','nip','regon','officialName'])
  demand(id.krs===v.selectedKrs&&id.entityKey==='PL:KRS:'+v.selectedKrs,'IDENTIFIER_CONFLICT')
  demand(nip(id.nip),'INVALID_NIP');demand(id.regon===null||regon(id.regon),'INVALID_REGON');demand(text(id.officialName,1000))
  const s=closed(v.source,['provider','register','extract','sourceRecordId','sourceVersion','normalizerVersion','rawDigest','contentDigest','sourceAsOfDate','entryNumber','retrievedAt','checkedAt'])
  demand(s.provider==='KRS'&&['P','S'].includes(s.register as string)&&s.extract==='CURRENT'&&s.sourceRecordId===v.selectedKrs,'IDENTIFIER_CONFLICT')
  demand(text(s.sourceVersion)&&acceptedNormalizerVersion(s.normalizerVersion),'UNSUPPORTED_EVIDENCE_VERSION')
  demand(digest(s.rawDigest)&&digest(s.contentDigest)&&(s.sourceAsOfDate===null||calendarDate(s.sourceAsOfDate)))
  demand(s.entryNumber===null||(Number.isSafeInteger(s.entryNumber)&&(s.entryNumber as number)>0))
  demand(instant(s.retrievedAt)&&instant(s.checkedAt))
  const validity=closed(v.validity,['policy','maxAgeSeconds','maxClockSkewSeconds','expiresAt'])
  demand(validity.policy==='KRS_FINANCIAL_IDENTITY_FRESHNESS_V1'&&validity.maxAgeSeconds===300&&validity.maxClockSkewSeconds===30&&instant(validity.expiresAt))
  const retrieved=Date.parse(s.retrievedAt as string),checked=Date.parse(s.checkedAt as string),expires=Date.parse(validity.expiresAt as string)
  demand(checked>=retrieved&&retrieved<=now+30000&&checked<=now+30000&&retrieved>now-300000&&checked>now-300000&&expires===retrieved+300000&&now<expires,'STALE_IDENTITY_EVIDENCE')
  demand(text(v.evidenceRef)&&digest(v.evidenceDigest)&&Array.isArray(v.historicalCandidates)&&v.historicalCandidates.length<=100)
  const seen=new Set<string>()
  for(const candidate of v.historicalCandidates as unknown[]){
    const c=closed(candidate,['krs','relationship','basis','evidenceRefs','evidenceDigest'])
    demand(krs(c.krs)&&c.krs!==v.selectedKrs&&!seen.has(c.krs));seen.add(c.krs)
    demand(['PREDECESSOR_CANDIDATE','SUCCESSOR_CANDIDATE'].includes(c.relationship as string)&&c.basis==='KRS_FORMATION_TRANSFORMATION'&&digest(c.evidenceDigest))
    demand(Array.isArray(c.evidenceRefs)&&c.evidenceRefs.length>=1&&c.evidenceRefs.length<=4&&c.evidenceRefs.every(x=>text(x))&&new Set(c.evidenceRefs).size===c.evidenceRefs.length)
  }
  demand(await identityDigest(v as unknown as VerifiedIdentityV1)===v.evidenceDigest,'FORGED_EVIDENCE_DIGEST')
  return v as unknown as VerifiedIdentityV1
}
