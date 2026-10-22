export * from './validation.js'
export * from './identity.js'
import type {HistoricalRegistrationCandidateV1} from './identity.js'
import {closed,demand,text,krs,nip,regon,digest,instant,calendarDate,canonical,sha256,parseJson} from './validation.js'
import {acceptedNormalizerVersion} from './identity.js'
export const REGISTRY_CONTRACT = Object.freeze({id:'profitia.krs-registry',version:'1.0.0'})
export type Register = 'P'|'S'
export type Extract = 'CURRENT'|'FULL'
export type RegistryState = 'ACTIVE'|'REMOVED'|'UNKNOWN'
export type Address = {country:string|null;postalCode:string|null;city:string|null;street:string|null;building:string|null;unit:string|null}
export type Source = {provider:'KRS';register:Register;extract:Extract;sourceRecordId:string;sourceVersion:string;normalizerVersion:string;rawDigest:string;contentDigest:string;sourceAsOfDate:string|null;entryNumber:number|null;retrievedAt:string;checkedAt:string}
export type IdentifierObservation = {kind:'NIP'|'REGON';value:string;valid:boolean;introducedEntry:number|null;removedEntry:number|null}
export type NameObservation = {name:string;introducedEntry:number|null;removedEntry:number|null}
export type RegistryHistory = {entries:{number:number;date:string|null}[];legalForms:NameObservation[];addresses:{value:Address;introducedEntry:number|null;removedEntry:number|null}[]}
export type CompanySnapshot = {
  contract:'profitia.krs-registry';version:'1.0.0';entityKey:string;canonicalKrs:string;officialName:string|null;nip:string|null;regon:string|null;
  legalForm:string|null;state:RegistryState;statusEvidence:string|null;registeredOn:string|null;removedOn:string|null;address:Address|null;addressVersion:string|null;
  names:NameObservation[];identifiers:IdentifierObservation[];historicalCandidates:HistoricalRegistrationCandidateV1[];history:RegistryHistory;
  missingFields:string[];warnings:string[];source:Source;evidenceRef:string;
}
export type Coverage = {scope:'PROGRESSIVE';asOf:string|null;bootstrapReference:string|null;pendingChanges:number|null;observedCompanies:number;totalCompanies:null}
export type CompanyCandidate = {entityKey:string;krs:string;officialName:string|null;nip:string|null;regon:string|null;locality:string|null;state:RegistryState;historicalNameMatch:boolean;sourceVersion:string;retrievedAt:string;financiallyVerified:false}
export type SearchResult = {status:'SUCCESS'|'NOT_IN_CATALOG';candidates:CompanyCandidate[];nextCursor:string|null;coverage:Coverage}
export type RegistryCommand = {operation:'CURRENT'|'FULL';krs:string;register:Register}|{operation:'DAILY';day:string}|{operation:'HOURLY';day:string;from:number;to:number}
export async function validateCompanySnapshot(input:unknown):Promise<CompanySnapshot>{
  const value=parseJson(typeof input==='string'?input:canonical(input),1048576)
  demand(new TextEncoder().encode(canonical(value)).length<=1048576,'OVERSIZED_JSON')
  const v=closed(value,['contract','version','entityKey','canonicalKrs','officialName','nip','regon','legalForm','state','statusEvidence','registeredOn','removedOn','address','addressVersion','names','identifiers','historicalCandidates','history','missingFields','warnings','source','evidenceRef'])
  demand(v.contract==='profitia.krs-registry'&&v.version==='1.0.0'&&krs(v.canonicalKrs)&&v.entityKey==='PL:KRS:'+v.canonicalKrs)
  for(const field of ['officialName','legalForm','statusEvidence'])demand(v[field]===null||text(v[field],1000))
  demand(v.nip===null||text(v.nip,14));demand(v.regon===null||text(v.regon,14))
  demand(['ACTIVE','REMOVED','UNKNOWN'].includes(v.state as string))
  for(const field of ['registeredOn','removedOn'])demand(v[field]===null||calendarDate(v[field]))
  if(v.address!==null){const a=closed(v.address,['country','postalCode','city','street','building','unit']);demand(Object.values(a).every(x=>x===null||text(x,256)))}
  demand((v.address===null&&v.addressVersion===null)||(v.address!==null&&typeof v.addressVersion==='string'&&/^address\/1:[a-f0-9]{64}$/.test(v.addressVersion)))
  const interval=(o:Record<string,unknown>)=>{for(const key of ['introducedEntry','removedEntry'])demand(o[key]===null||Number.isSafeInteger(o[key])&&(o[key] as number)>0)}
  demand(Array.isArray(v.names)&&v.names.length<=10000)
  for(const value of v.names){const n=closed(value,['name','introducedEntry','removedEntry']);demand(text(n.name,1000));interval(n)}
  const history=closed(v.history,['entries','legalForms','addresses'])
  demand(Array.isArray(history.entries)&&history.entries.length<=10000&&Array.isArray(history.legalForms)&&history.legalForms.length<=10000&&Array.isArray(history.addresses)&&history.addresses.length<=10000)
  for(const value of history.entries){const e=closed(value,['number','date']);demand(Number.isSafeInteger(e.number)&&(e.number as number)>0&&(e.date===null||calendarDate(e.date)))}
  for(const value of history.legalForms){const n=closed(value,['name','introducedEntry','removedEntry']);demand(text(n.name,1000));interval(n)}
  for(const value of history.addresses){const n=closed(value,['value','introducedEntry','removedEntry']);interval(n);const a=closed(n.value,['country','postalCode','city','street','building','unit']);demand(Object.values(a).every(x=>x===null||text(x,256)))}
  demand(Array.isArray(v.identifiers)&&v.identifiers.length<=10000)
  for(const value of v.identifiers){const id=closed(value,['kind','value','valid','introducedEntry','removedEntry']);demand(['NIP','REGON'].includes(id.kind as string)&&text(id.value,14)&&typeof id.valid==='boolean');demand(id.valid===(id.kind==='NIP'?nip(id.value):regon(id.value)));interval(id)}
  demand(Array.isArray(v.historicalCandidates)&&v.historicalCandidates.length<=100)
  const seen=new Set()
  for(const value of v.historicalCandidates){const h=closed(value,['krs','relationship','basis','evidenceRefs','evidenceDigest']);demand(krs(h.krs)&&h.krs!==v.canonicalKrs&&!seen.has(h.krs));seen.add(h.krs);demand(['PREDECESSOR_CANDIDATE','SUCCESSOR_CANDIDATE'].includes(h.relationship as string)&&h.basis==='KRS_FORMATION_TRANSFORMATION'&&digest(h.evidenceDigest));demand(Array.isArray(h.evidenceRefs)&&h.evidenceRefs.length>=1&&h.evidenceRefs.length<=4&&h.evidenceRefs.every(x=>text(x))&&new Set(h.evidenceRefs).size===h.evidenceRefs.length)}
  for(const field of ['missingFields','warnings'])demand(Array.isArray(v[field])&&(v[field] as unknown[]).length<=100&&(v[field] as unknown[]).every(x=>text(x)))
  const s=closed(v.source,['provider','register','extract','sourceRecordId','sourceVersion','normalizerVersion','rawDigest','contentDigest','sourceAsOfDate','entryNumber','retrievedAt','checkedAt'])
  demand(s.provider==='KRS'&&['P','S'].includes(s.register as string)&&['CURRENT','FULL'].includes(s.extract as string)&&s.sourceRecordId===v.canonicalKrs&&acceptedNormalizerVersion(s.normalizerVersion)&&text(s.sourceVersion)&&digest(s.rawDigest)&&digest(s.contentDigest)&&(s.sourceAsOfDate===null||calendarDate(s.sourceAsOfDate)))
  demand((s.entryNumber===null||Number.isSafeInteger(s.entryNumber)&&(s.entryNumber as number)>0)&&instant(s.retrievedAt)&&instant(s.checkedAt)&&Date.parse(s.checkedAt)>=Date.parse(s.retrievedAt))
  demand(text(v.evidenceRef))
  const {contract,version,source,evidenceRef,...facts}=v
  demand(await sha256(canonical(facts))===s.contentDigest,'CONTENT_DIGEST_MISMATCH')
  return v as unknown as CompanySnapshot
}
