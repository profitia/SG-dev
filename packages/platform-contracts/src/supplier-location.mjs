import {createHash} from 'node:crypto'

// Closed technical evidence consumed by the ONE operation-context engine.
// This validates server-selected facts; it issues no identity, grant or ALLOW.
export const SUPPLIER_LOCATION_CONTRACT = Object.freeze({id:'profitia.supplier-location-operation',version:'1.0.0',defaultPaidGeocodingAllowance:0})
export const supplierLocationSchemaUrl=new URL('../migrations/access/019-supplier-location-operations.sql',import.meta.url).href
export const SUPPLIER_LOCATION_OPERATIONS=Object.freeze(['supplier.location.read','supplier.location.write','supplier.location.sync','supplier.location.geocode'])
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const text=v=>typeof v==='string'&&v.length>0&&v.length<=256
const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).length===keys.length&&Object.keys(v).sort().join(',')===[...keys].sort().join(',')&&Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>'value'in d&&d.enumerable)
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
const fail=()=>{throw new TypeError('Supplier location evidence unavailable')}
const current=(v,time)=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v&&Date.parse(v)>time
export function normalizeSupplierLocationEvidence(value,{environment,organisationId,now=Date.now}={}){
 const keys=['supplierId','locationId','group','origin','addressVersion','targetVersion','exists','serverAssignedId','commandDigest','executorApplicationId','sources']
 if(!exact(value,keys)||!uuid.test(value.supplierId??'')||!(value.locationId===null||uuid.test(value.locationId??''))
  ||!['ALL','SUPPLIER_LOCATIONS','RELATED_ENTITIES','USER_LOCATIONS'].includes(value.group)||!['COLLECTION','SOURCE','MANUAL'].includes(value.origin)
  ||!(value.addressVersion===null||text(value.addressVersion))||!text(value.targetVersion)||typeof value.exists!=='boolean'||typeof value.serverAssignedId!=='boolean'
  ||!/^[a-f0-9]{64}$/.test(value.commandDigest??'')||!(value.executorApplicationId===null||text(value.executorApplicationId))
  ||!Array.isArray(value.sources)||value.sources.length>64||!['development','staging','production'].includes(environment)||!uuid.test(organisationId??''))fail()
 if(value.origin==='MANUAL'&&(value.group!=='USER_LOCATIONS'||value.sources.length!==0||!uuid.test(value.locationId??'')))fail()
 if(value.origin==='SOURCE'&&(!['SUPPLIER_LOCATIONS','RELATED_ENTITIES'].includes(value.group)||!value.sources.length||!uuid.test(value.locationId??'')))fail()
 if(value.group==='RELATED_ENTITIES'&&!value.sources.some(s=>s?.kind==='KYS'))fail()
 const seen=new Set()
 for(const s of value.sources){
  const r=s?.resource
  if(!exact(s,['kind','accepted','entityType','retentionUntil','resource'])||!['MGBI','KYS'].includes(s.kind)||s.accepted!==true||s.entityType!=='COMPANY'
   ||!(s.retentionUntil===null||current(s.retentionUntil,now()))||!r||Object.getPrototypeOf(r)!==Object.prototype
   ||!['id','version','projectionVersion'].every(k=>text(r[k]))||r.environment!==environment||r.ownerUserId!==null||seen.has(s.kind+':'+r.id))fail()
  seen.add(s.kind+':'+r.id)
  const base=['id','version','projectionVersion','environment','ownerOrganisationId','ownerUserId','type','dataClass']
  if(s.kind==='MGBI'){
   if(!exact(r,[...base,'approvedSharedProjection'])||r.type!=='supplier_report'||r.dataClass!=='SHARED_KNOWLEDGE'||r.ownerOrganisationId!==null||r.approvedSharedProjection!==true)fail()
  }else{
   const d=r.privateSupplier
   if(!exact(r,[...base,'privateSupplier'])||r.type!=='supplier_private_report'||r.dataClass!=='ORGANISATION_PRIVATE'||r.ownerOrganisationId!==organisationId
    ||!exact(d,['nip','entityType','snapshotId','retentionUntil'])||d.entityType!=='COMPANY'||!/^[0-9]{10}$/.test(d.nip??'')||!uuid.test(d.snapshotId??'')||d.snapshotId!==r.version
    ||s.retentionUntil!==d.retentionUntil||!current(d.retentionUntil,now()))fail()
  }
 }
 return freeze(structuredClone(value))
}
export async function supplierLocationSchemaDigest(){const fs=await import('node:fs');return createHash('sha256').update(fs.readFileSync(new URL(supplierLocationSchemaUrl))).digest('hex')}
