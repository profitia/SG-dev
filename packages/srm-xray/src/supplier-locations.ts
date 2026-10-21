/** Host-neutral supplier locations. Identity and permissions are resolved by the host. */
export const SUPPLIER_LOCATION_GROUPS = ['SUPPLIER_LOCATIONS', 'RELATED_ENTITIES', 'USER_LOCATIONS'] as const
export type SupplierLocationGroup = typeof SUPPLIER_LOCATION_GROUPS[number]
export type PostalAddress = Readonly<{line1:string|null;postalCode:string|null;locality:string|null;country:string|null}>
export type LocationPosition = Readonly<{lat:number;lng:number}>
export type LocationCoordinates = Readonly<{position:LocationPosition;origin:'USER_INPUT'|'GOOGLE_GEOCODING'|'LICENSED_SOURCE';fetchedAt:string;expiresAt:string|null;placeId?:string}>
export type LocationSource = Readonly<{kind:'MGBI'|'KYS';reportId:string;version:string;retrievedAt:string;effectiveAt:string|null;retentionUntil:string|null}>
export type SupplierLocation = Readonly<{
 id:string;supplierId:string;group:SupplierLocationGroup;kind:'HEADQUARTERS'|'BRANCH'|'RELATED_ENTITY_HEADQUARTERS'|'USER_DEFINED';origin:'SOURCE'|'MANUAL'
 label:string;description:string;address:PostalAddress|null;originalAddress:string|null;addressVersion:string
 entityKey:string;sourceVersion:string|null;sources:readonly LocationSource[]
 relationship:Readonly<{type:string|null;start:string|null;end:string|null;identity:'VERIFIED_KRS'|'VERIFIED_MGBI_MATCH'}>|null
 version:string;lifecycle:'ACTIVE'|'INACTIVE';verification:'VERIFIED_SOURCE'|'USER_PROVIDED'|'INCOMPLETE'|'UNRESOLVED'
 geocodingStatus:'UNREQUESTED'|'RESOLVED'|'UNRESOLVED'|'AMBIGUOUS'|'LOW_PRECISION'|'EXPIRED'|'QUOTA_EXCEEDED'|'UNAVAILABLE'|'DELIVERY_UNCERTAIN'
 coordinates:LocationCoordinates|null;createdAt:string;updatedAt:string;createdByUserId:string;updatedByUserId:string
}>
export type ManualLocationInput = Readonly<{label:string;description:string;address:PostalAddress;position:LocationPosition|null}>
export type SupplierLocationPage = Readonly<{
 supplierId:string;items:readonly SupplierLocation[];offset:number;limit:number;total:number;hasMore:boolean;collectionVersion:string
 coverage:Readonly<{headquarters:'AVAILABLE'|'MISSING'|'UNAVAILABLE';branches:'NOT_CONFIRMED';relatedEntities:'AVAILABLE'|'UNAVAILABLE';sync:'CURRENT'|'PENDING'}>
}>
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&Object.getPrototypeOf(v)===Object.prototype
const text=(v:unknown,max:number,empty=false):string=>{
 if(typeof v!=='string'||v.length>max||/[\u0000-\u001f\u007f]/u.test(v)||!empty&&!v.trim())throw new TypeError('Invalid location field')
 return v.trim().normalize('NFC')
}
export function validLocationPosition(v:unknown):v is LocationPosition{
 return plain(v)&&Object.keys(v).sort().join(',')==='lat,lng'&&typeof v.lat==='number'&&typeof v.lng==='number'
  &&Number.isFinite(v.lat)&&Number.isFinite(v.lng)&&Math.abs(v.lat)<=90&&Math.abs(v.lng)<=180
}
export function displayPostalAddress(a:PostalAddress|null):string{
 return a?[a.line1,[a.postalCode,a.locality].filter(Boolean).join(' '),a.country].filter(Boolean).join(', '):''
}
export function completePostalAddress(a:PostalAddress|null):boolean{
 return !!a&&[a.line1,a.postalCode,a.locality,a.country].every(v=>typeof v==='string'&&v.trim().length>0)
}
/** Closed input: no caller-provided owner, author, provenance or provider cache. */
export function parseManualLocation(value:unknown):ManualLocationInput{
 if(!plain(value)||Object.keys(value).sort().join(',')!=='address,description,label,position'||!plain(value.address)
  ||Object.keys(value.address).sort().join(',')!=='country,line1,locality,postalCode')throw new TypeError('Invalid manual location')
 const address={line1:text(value.address.line1,200),postalCode:text(value.address.postalCode,20),locality:text(value.address.locality,100),country:text(value.address.country,80)}
 if(displayPostalAddress(address).length>512||value.position!==null&&!validLocationPosition(value.position))throw new TypeError('Invalid location position or address')
 return Object.freeze({label:text(value.label,160),description:text(value.description,1024,true),address:Object.freeze(address),position:value.position===null?null:Object.freeze({...value.position})})
}
export function currentLocationCoordinates(location:Pick<SupplierLocation,'coordinates'|'lifecycle'>,now=Date.now()):LocationPosition|null{
 const c=location.coordinates
 if(location.lifecycle!=='ACTIVE'||!c||!validLocationPosition(c.position)||!Number.isFinite(Date.parse(c.fetchedAt))||Date.parse(c.fetchedAt)>now)return null
 if(!['USER_INPUT','GOOGLE_GEOCODING','LICENSED_SOURCE'].includes(c.origin))return null
 if(c.origin==='GOOGLE_GEOCODING'&&(!c.expiresAt||Date.parse(c.expiresAt)-Date.parse(c.fetchedAt)>30*86400000))return null
 if(c.expiresAt!==null&&(!Number.isFinite(Date.parse(c.expiresAt))||Date.parse(c.expiresAt)<=now))return null
 return c.position
}
/** Only an already authorised page enters the renderer. Host provenance stays out. */
export function supplierLocationsMapProjection(items:readonly SupplierLocation[],now=Date.now()){
 if(items.length>500)throw new TypeError('Page/filter supplier locations before map projection')
 return items.filter(v=>v.lifecycle==='ACTIVE').map(v=>({id:v.id,label:v.label,...(displayPostalAddress(v.address)?{address:displayPostalAddress(v.address).slice(0,512)}:{}),kind:v.kind,
  ...(currentLocationCoordinates(v,now)?{position:currentLocationCoordinates(v,now)!}:{})}))
}
