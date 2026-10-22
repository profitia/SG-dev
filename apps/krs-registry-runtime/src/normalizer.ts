import {canonical, sha256, demand, krs, nip, regon, calendarDate, instant, parseJson, NORMALIZER_VERSION,validateCompanySnapshot} from '@profitia/krs-registry-contracts'
import type {CompanySnapshot, Register, Extract, Address, IdentifierObservation, NameObservation, HistoricalRegistrationCandidateV1,RegistryHistory} from '@profitia/krs-registry-contracts'
type ObjectValue = Record<string, unknown>
const obj=(v:unknown):ObjectValue=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as ObjectValue:{}
const str=(v:unknown):string|null=>typeof v==='string'&&v.trim()!==''?v.trim().normalize('NFC'):null
const entry=(v:unknown):number|null=>Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):null
function date(v:unknown):string|null{
  const s=str(v);if(!s)return null
  const m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s),d=m?`${m[3]}-${m[2]}-${m[1]}`:s
  return calendarDate(d)?d:null
}
/** Conservative address equality: Unicode, case and whitespace only; no abbreviation guesses. */
export const addressText=(v:string|null)=>v?.normalize('NFKC').toLocaleLowerCase('pl-PL').replace(/\s+/gu,' ').trim()??null
export async function addressVersion(address:Address|null):Promise<string|null>{
  return address===null?null:'address/1:'+await sha256(canonical(Object.fromEntries(Object.entries(address).map(([k,v])=>[k,addressText(v)]))))
}
export function normalizeSearch(value:string):string{
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[łŁ]/g,'l').toLocaleLowerCase('pl-PL').replace(/\s+/gu,' ').trim()
}
export function nameTokens(value:string):string[]{
  const n=normalizeSearch(value),abbreviated=n.replace(/spolka z ograniczona odpowiedzialnoscia/g,'sp. z o.o.').replace(/spolka akcyjna/g,'s.a.').replace(/spolka komandytowa/g,'sp.k.')
  const expanded=n.replace(/sp\.?\s*z\s*o\.?\s*o\.?/g,'spolka z ograniczona odpowiedzialnoscia').replace(/\bs\.?\s*a\.(?=\s|$)/g,'spolka akcyjna')
  return [...new Set([n,abbreviated,expanded])]
}
function versions(value:unknown,kind:string):Array<{value:unknown;introducedEntry:number|null;removedEntry:number|null}>{
  if(!Array.isArray(value)){
    if(value===undefined||value===null)return []
    const o=obj(value)
    return [{value:Object.hasOwn(o,kind)?o[kind]:value,introducedEntry:entry(o.nrWpisuWprow),removedEntry:entry(o.nrWpisuWykr)}]
  }
  return value.map(item=>{const o=obj(item);return {value:o[kind]??o.wartosc,introducedEntry:entry(o.nrWpisuWprow),removedEntry:entry(o.nrWpisuWykr)}})
}
export async function normalizeExtract(bytes:Uint8Array, options:{krs:string;register:Register;extract:Extract;retrievedAt:string}):Promise<CompanySnapshot>{
  demand(krs(options.krs)&&['P','S'].includes(options.register)&&['CURRENT','FULL'].includes(options.extract)&&instant(options.retrievedAt))
  demand(bytes.length<=4*1024*1024,'OVERSIZED_RESPONSE')
  const raw=parseJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes),4*1024*1024),odpis=obj(obj(raw).odpis)
  const header=obj(odpis[options.extract==='CURRENT'?'naglowekA':'naglowekP'])
  demand(header.numerKRS===options.krs&&header.rejestr==='Rej'+options.register,'IDENTIFIER_CONFLICT')
  const data=obj(odpis.dane),section=obj(data.dzial1),entity=obj(section.danePodmiotu)
  const full=options.extract==='FULL',warnings:string[]=[],missingFields:string[]=[]
  const names:NameObservation[]=versions(entity.nazwa,'nazwa').flatMap(v=>str(v.value)?[{name:str(v.value)!,introducedEntry:v.introducedEntry,removedEntry:v.removedEntry}]:[])
  // Full extracts only select an explicitly open interval, never the last array element.
  const currentNames=names.filter(v=>v.removedEntry===null)
  const officialName=currentNames.length===1?currentNames[0]!.name:null
  if(full&&currentNames.length>1)warnings.push('AMBIGUOUS_CURRENT_NAME')
  const identifiers:IdentifierObservation[]=[]
  const idObjects=Array.isArray(entity.identyfikatory)?entity.identyfikatory:[entity.identyfikatory]
  for(const item of idObjects){const wrapper=obj(item),ids=obj(wrapper.identyfikatory??item)
    for(const kind of ['NIP','REGON'] as const){const field=kind.toLowerCase()
      for(const v of versions(ids[field],field)){
        const value=str(v.value);if(value)identifiers.push({kind,value,valid:kind==='NIP'?nip(value):regon(value),introducedEntry:v.introducedEntry??entry(wrapper.nrWpisuWprow),removedEntry:v.removedEntry??entry(wrapper.nrWpisuWykr)})
      }
    }
  }
  const currentId=(kind:'NIP'|'REGON')=>{const values=[...new Set(identifiers.filter(i=>i.kind===kind&&i.removedEntry===null).map(i=>i.value))];if(values.length>1)warnings.push('CONFLICTING_'+kind);return values.length===1?values[0]!:null}
  const currentNip=currentId('NIP'),currentRegon=currentId('REGON')
  let legalForm:string|null=null
  const forms=versions(entity.formaPrawna,'formaPrawna').filter(v=>v.removedEntry===null);if(forms.length===1)legalForm=str(forms[0]!.value)
  const known=/SPÓŁKA|FUNDACJA|STOWARZYSZENIE|SPÓŁDZIELNIA|PRZEDSIĘBIORSTWO|ZWIĄZEK|IZBA|KOŁO|TOWARZYSTWO|ORGANIZACJA|CECH|WSPÓLNOTA|INSTYTUT/iu
  if(legalForm&&!known.test(legalForm))warnings.push('UNSUPPORTED_LEGAL_FORM')
  const addressInput=obj(section.siedzibaIAdres).adres,addressOptions=Array.isArray(addressInput)?addressInput:[addressInput]
  const openAddresses=addressOptions.filter(v=>entry(obj(v).nrWpisuWykr)===null)
  const rawAddress=openAddresses.length===1?obj(openAddresses[0]):{}
  if(openAddresses.length>1)warnings.push('AMBIGUOUS_CURRENT_ADDRESS')
  const address:Address|null=Object.keys(rawAddress).length?{country:str(rawAddress.kraj),postalCode:str(rawAddress.kodPocztowy),city:str(rawAddress.miejscowosc),street:str(rawAddress.ulica),building:str(rawAddress.nrDomu),unit:str(rawAddress.nrLokalu)}:null
  const removed=obj(obj(data.dzial6).informacjaOWykresleniu),removedOn=date(removed.dataWykresleniaZRejestru)
  const state=removedOn&&removed.czyWykreslony===true?'REMOVED':header.stanPozycji===1?'ACTIVE':'UNKNOWN'
  const statusEvidence=state==='REMOVED'?'EXPLICIT_REMOVAL_DATE_AND_FLAG':state==='ACTIVE'?'HEADER_STAN_POZYCJI_1':null
  if(state==='UNKNOWN')warnings.push('UNKNOWN_REGISTRY_STATUS')
  const registeredOn=date(header.dataRejestracjiWKRS),sourceAsOfDate=date(header.stanZDnia)
  for(const [key,value] of Object.entries({officialName,nip:currentNip,regon:currentRegon,legalForm,address,registeredOn,sourceAsOfDate}))if(value===null)missingFields.push(key)
  if(header.stanZDnia&&!sourceAsOfDate)warnings.push('INVALID_SOURCE_DATE')
  const history:RegistryHistory={entries:[],legalForms:[],addresses:[]}
  if(full){
    const entries=Array.isArray(header.wpis)?header.wpis:[]
    for(const value of entries){const e=obj(value),number=entry(e.numerWpisu);if(number)history.entries.push({number,date:date(e.dataWpisu)})}
    history.entries.sort((a,b)=>a.number-b.number)
    history.legalForms=versions(entity.formaPrawna,'formaPrawna').flatMap(v=>str(v.value)?[{name:str(v.value)!,introducedEntry:v.introducedEntry,removedEntry:v.removedEntry}]:[])
    for(const value of addressOptions){const a=obj(value);if(Object.keys(a).length)history.addresses.push({value:{country:str(a.kraj),postalCode:str(a.kodPocztowy),city:str(a.miejscowosc),street:str(a.ulica),building:str(a.nrDomu),unit:str(a.nrLokalu)},introducedEntry:entry(a.nrWpisuWprow),removedEntry:entry(a.nrWpisuWykr)})}
  }
  const historicalCandidates:HistoricalRegistrationCandidateV1[]=[]
  // Only explicit formation/transformations, no arbitrary related-party KRS scan.
  const formation=obj(section.informacjaOPowstaniuPodmiotu),links=Array.isArray(formation.podmiotyWczesniejZarejestrowane)?formation.podmiotyWczesniejZarejestrowane:[]
  if(formation.okolicznosciPowstania==='PRZEKSZTAŁCENIE')for(const link of links.slice(0,100)){
    const l=obj(link),id=str(l.numerKRS)
    if(id&&krs(id)&&id!==options.krs&&!historicalCandidates.some(c=>c.krs===id))historicalCandidates.push({krs:id,relationship:'PREDECESSOR_CANDIDATE',basis:'KRS_FORMATION_TRANSFORMATION',evidenceRefs:[`KRS:${options.krs}:formation`],evidenceDigest:await sha256(canonical({krs:id,formation:'PRZEKSZTAŁCENIE'}))})
  }
  names.sort((a,b)=>a.name.localeCompare(b.name)||(a.introducedEntry??0)-(b.introducedEntry??0))
  identifiers.sort((a,b)=>a.kind.localeCompare(b.kind)||a.value.localeCompare(b.value)||(a.introducedEntry??0)-(b.introducedEntry??0))
  historicalCandidates.sort((a,b)=>a.krs.localeCompare(b.krs))
  const facts={entityKey:'PL:KRS:'+options.krs,canonicalKrs:options.krs,officialName,nip:currentNip,regon:currentRegon,legalForm,state,statusEvidence,registeredOn,removedOn,address,addressVersion:await addressVersion(address),names,identifiers,historicalCandidates,history,missingFields:missingFields.sort(),warnings:warnings.sort()}
  const contentDigest=await sha256(canonical(facts)),rawDigest=await sha256(bytes)
  const sourceVersion=`KRS:${options.register}:${options.extract}:${options.krs}:${entry(header.numerOstatniegoWpisu)??'UNKNOWN'}:${sourceAsOfDate??'UNKNOWN'}:${contentDigest}:${NORMALIZER_VERSION}`
  const evidenceRef='KRS:'+options.krs+':'+await sha256(canonical({sourceVersion,rawDigest,retrievedAt:options.retrievedAt}))
  return validateCompanySnapshot({contract:'profitia.krs-registry',version:'1.0.0',...facts,state,source:{provider:'KRS',register:options.register,extract:options.extract,sourceRecordId:options.krs,sourceVersion,normalizerVersion:NORMALIZER_VERSION,rawDigest,contentDigest,sourceAsOfDate,entryNumber:entry(header.numerOstatniegoWpisu),retrievedAt:options.retrievedAt,checkedAt:options.retrievedAt},evidenceRef})
}
