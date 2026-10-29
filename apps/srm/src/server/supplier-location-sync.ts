import {createHash} from 'node:crypto'
import type {GeneralCompanyData,SectionEnvelope,VerclyKysData,PostalAddress,LocationSource,SupplierLocation} from '@profitia/srm-xray'
import {completePostalAddress,displayPostalAddress} from '@profitia/srm-xray'
import {registryCalendarDate} from './company-continuity'

export const LOCATION_PROJECTOR_VERSION='srm-supplier-locations-v1'
export const POLISH_RURAL_ADDRESS_PROJECTION='srm-polish-rural-address-v1'
export type LocationProjection=Pick<SupplierLocation,'group'|'kind'|'label'|'description'|'address'|'originalAddress'|'entityKey'|'sources'|'relationship'|'verification'|'lifecycle'>
export type AcceptedCompanyAddress=Readonly<{supplierId:string;nip:string;krs:string;section:SectionEnvelope<GeneralCompanyData>;source:LocationSource;structuredAddress:PostalAddress|null;addressProjection?:typeof POLISH_RURAL_ADDRESS_PROJECTION}>
export type AcceptedRelatedSource=Readonly<{supplierId:string;source:LocationSource;entities:NonNullable<VerclyKysData['relatedEntities']>;complete:boolean}>
const object=(v:unknown):v is Record<string,unknown>=>!!v&&Object.getPrototypeOf(v)===Object.prototype
const text=(v:unknown,max=160):string|null=>typeof v==='string'&&v.trim()&&v.length<=max&&!/[\u0000-\u001f\u007f]/u.test(v)?v.trim().normalize('NFC'):null
export const locationDigest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const date=(v:string|null)=>v===null?null:registryCalendarDate(v)
function sourceValid(source:LocationSource,kind:'MGBI'|'KYS',now:number){
 if(source.kind!==kind||!text(source.reportId,256)||!text(source.version,256)||!Number.isFinite(Date.parse(source.retrievedAt))||Date.parse(source.retrievedAt)>now
  ||source.effectiveAt!==null&&!Number.isFinite(Date.parse(source.effectiveAt))
  ||kind==='KYS'&&(!source.retentionUntil||!Number.isFinite(Date.parse(source.retentionUntil))||Date.parse(source.retentionUntil)<=now))throw new TypeError('Current accepted location source required')
}
/** Same bounded KRS fields for fresh responses and checksum-verified archives. */
export function mgbiStructuredLocationAddress(record:unknown,projection?:string):PostalAddress|null{
 let value=record
 for(const key of ['content','current_excerpt','dane','dzial1','siedzibaIAdres','adres'])value=object(value)?value[key]:null
 if(!object(value))return null
 const street=text(value.ulica,100),number=text(value.nrDomu,30),unit=text(value.nrLokalu,30)
 const locality=text(value.miejscowosc,100),country=text(value.kraj,80)
 // A village without named streets uses its locality and building number.
 // Both come from the same verified record; no street or coordinate is inferred.
 const rural=projection===POLISH_RURAL_ADDRESS_PROJECTION&&!street&&!!locality&&!!number
  &&/^\d{1,6}[a-z]?(?:[-/]\d{1,6}[a-z]?)?$/i.test(number)&&['PL','POLSKA','POLAND'].includes(country?.toUpperCase()??'')
 const line=[street??(rural?locality:null),number].filter(Boolean).join(' ')
 return {line1:line?line+(unit?'/'+unit:''):null,postalCode:text(value.kodPocztowy,20),locality,country}
}
export function projectSupplierHeadquarters(input:AcceptedCompanyAddress,now=Date.now()):LocationProjection|null{
 sourceValid(input.source,'MGBI',now)
 const data=input.section.data
 if(!['SUCCESS','PARTIAL'].includes(input.section.status)||!data)return null
 if(data.nip!==input.nip||data.krs!==input.krs||!/^[0-9]{10}$/.test(input.krs)||/^0+$/.test(input.krs)
  ||input.section.source.provider!=='MGBI'||input.section.source.model!=='pl-krs-wp-record'
  ||input.section.retrievedAt!==input.source.retrievedAt)throw new TypeError('Supplier/source identity mismatch')
 if(data.registrationStatus==='DEREGISTERED')return null
 const address=input.structuredAddress,display=data.registeredAddress
 return {group:'SUPPLIER_LOCATIONS',kind:'HEADQUARTERS',label:text(data.legalName)??'Siedziba dostawcy',description:'',
  address:address??(text(display,512)?{line1:text(display,512),postalCode:null,locality:null,country:null}:null),originalAddress:text(display,512),
  entityKey:'SUPPLIER:'+input.supplierId+':HEADQUARTERS',sources:[input.source],relationship:null,
  verification:completePostalAddress(address)?'VERIFIED_SOURCE':display?'INCOMPLETE':'UNRESOLVED',lifecycle:'ACTIVE'}
}
/** No acquisition: only caller-provided, already accepted corporate records. */
export function projectRelatedCompanyLocations(input:AcceptedRelatedSource,corporate:readonly AcceptedCompanyAddress[],now=Date.now()):LocationProjection[]{
 sourceValid(input.source,'KYS',now)
 if(input.entities.length>2000)throw new TypeError('Related entity source requires bounded projection')
 const out:LocationProjection[]=[],seen=new Set<string>()
 for(const entity of input.entities){
  const krs=text(entity.krs,10),nip=text(entity.nip,10)
  const matches=corporate.filter(c=>krs?c.krs===krs:!!nip&&c.nip===nip)
  const verified=matches.length===1?matches[0]:null
  // DepEntities is not enough to turn a sole proprietor or a natural person into a legal company.
  if(!krs&&(!verified||!verified.krs))continue
  const legalKrs=krs??verified!.krs
  if(!/^[0-9]{10}$/.test(legalKrs)||/^0+$/.test(legalKrs))continue
  const role=text(entity.role,160),key='RELATED:KRS:'+legalKrs+':'+(role??'UNSPECIFIED')
  if(seen.has(key))continue
  seen.add(key)
  let headquarters:LocationProjection|null=null
  if(verified){
   // Contradictory identifiers must never select a convenient same-name address.
   if(nip&&verified.nip!==nip)throw new TypeError('Related company identity conflict')
   headquarters=projectSupplierHeadquarters(verified,now)
  }
  const end=date(entity.relationshipEnd),start=date(entity.relationshipStart)
  const active=(!end||Date.parse(end+'T23:59:59.999Z')>=now)&&(!start||Date.parse(start+'T00:00:00.000Z')<=now)
  const unknownDates=entity.relationshipEnd!==null&&!end||entity.relationshipStart!==null&&!start
  out.push({group:'RELATED_ENTITIES',kind:'RELATED_ENTITY_HEADQUARTERS',entityKey:key,label:text(entity.name)??'Podmiot powiązany',description:'',
   address:headquarters?.address??null,originalAddress:headquarters?.originalAddress??null,
   sources:[input.source,...(headquarters?.sources??[])],relationship:{type:role,start:entity.relationshipStart,end:entity.relationshipEnd,identity:krs?'VERIFIED_KRS':'VERIFIED_MGBI_MATCH'},
   verification:unknownDates?'INCOMPLETE':headquarters?.verification??'UNRESOLVED',lifecycle:active?'ACTIVE':'INACTIVE'})
 }
 return out
}
export function sourceAddressVersion(value:Pick<LocationProjection,'address'|'originalAddress'>):string{
 return locationDigest([LOCATION_PROJECTOR_VERSION,value.address,value.originalAddress])
}
export function sourceSyncIdentity(organisationId:string,supplierId:string,sources:readonly LocationSource[],addressProjection?:typeof POLISH_RURAL_ADDRESS_PROJECTION):string{
 if(addressProjection!==undefined&&addressProjection!==POLISH_RURAL_ADDRESS_PROJECTION)throw new TypeError('Unknown address projection')
 const input:unknown[]=[LOCATION_PROJECTOR_VERSION,organisationId,supplierId,sources.map(v=>[v.kind,v.reportId,v.version]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]
 // Only the corrected rural projection gets a new admitted reconciliation.
 // Existing source receipts and identities for other addresses are unchanged.
 if(addressProjection)input.push(addressProjection)
 return 'srm-location-sync-'+locationDigest(input)
}
/** Reconciliation never treats a missing/incomplete source as a deletion. */
export function sourceIsNewer(previous:LocationSource,next:LocationSource):boolean{
 if(previous.kind!==next.kind)throw new TypeError('Source families cannot overwrite each other')
 const before=Date.parse(previous.retrievedAt),after=Date.parse(next.retrievedAt)
 if(after<before)return false
 if(after===before&&previous.version!==next.version)throw new TypeError('Conflicting source versions at the same retrieval time')
 return after>before||previous.version===next.version
}
