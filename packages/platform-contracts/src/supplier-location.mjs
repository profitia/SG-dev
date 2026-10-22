import {createHash,createHmac} from 'node:crypto'

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


/** Optional P1: no permission catalog or HTTP identity. Same transaction only. */
export const SUPPLIER_LOCATION_ADMISSION_CONTRACT=Object.freeze({id:'profitia.supplier-location-admission',version:'1.0.0',rollingHours:24,capacity:100})
export const supplierLocationAdmissionSchemaUrl=new URL('../migrations/access/020-supplier-location-admission.sql',import.meta.url).href
export async function supplierLocationAdmissionSchemaDigest(){const fs=await import('node:fs');return createHash('sha256').update(fs.readFileSync(new URL(supplierLocationAdmissionSchemaUrl))).digest('hex')}
const admitted=new WeakSet()
export function isSupplierLocationAdmission(value){return !!value&&admitted.has(value)}
export function createSupplierLocationAdmission({binding,schemaDigest,proofKey,readParent}){
 if(!binding||!['applicationId','environment','role','projectId','branchId','databaseName'].every(k=>text(binding[k]))
  ||!['development','staging','production'].includes(binding.environment)||!/^[a-f0-9]{64}$/.test(schemaDigest??'')
  ||!(proofKey instanceof Uint8Array)||proofKey.byteLength!==32||typeof readParent!=='function')throw TypeError('Accepted SQL020, separate server key and current locked parent reader required')
 const b=structuredClone(binding),key=Buffer.from(proofKey)
 const one=async(query,sql,args=[])=>{const r=await query(sql,args);if(r?.rows?.length!==1)fail();return r.rows[0]}
 const locationId=({organisationId,userId,supplierId,idempotencyKey})=>{
  if(![organisationId,userId,supplierId].every(v=>uuid.test(v??''))||!/^[A-Za-z0-9_-]{24,128}$/.test(idempotencyKey??''))fail()
  const h=createHash('sha256').update(JSON.stringify(['profitia.manual-location@1',b.environment,b.applicationId,organisationId,userId,supplierId,idempotencyKey])).digest().subarray(0,16)
  h[6]=(h[6]&15)|128;h[8]=(h[8]&63)|128;const x=h.toString('hex');return `${x.slice(0,8)}-${x.slice(8,12)}-${x.slice(12,16)}-${x.slice(16,20)}-${x.slice(20)}`
 }
 return Object.freeze({contract:SUPPLIER_LOCATION_ADMISSION_CONTRACT,locationId,
  async bind(query,{actor,request,resource}){
   const e=normalizeSupplierLocationEvidence(resource?.supplierLocation,{environment:b.environment,organisationId:request.organisationId})
   const action=request.payload?.action
   if(actor?.kind!=='HUMAN'||actor.userId!==actor.actorId||!uuid.test(actor.actorId??'')||actor.environment!==b.environment||actor.audience!==b.applicationId
    ||!['supplier.location.write','supplier.location.sync'].includes(request.operation)||!['CREATE','UPDATE','DEACTIVATE','SYNC'].includes(action)
    ||request.operation==='supplier.location.sync'&&action!=='SYNC'||request.operation==='supplier.location.write'&&action==='SYNC'
    ||request.payload.supplierId!==e.supplierId||request.payload.locationId!==e.locationId)fail()
   if(action==='CREATE'&&(request.resourceId!==locationId({organisationId:request.organisationId,userId:actor.actorId,supplierId:e.supplierId,idempotencyKey:request.idempotencyKey})
    ||e.locationId!==request.resourceId||e.origin!=='MANUAL'||e.group!=='USER_LOCATIONS'||e.serverAssignedId!==true||request.payload.expectedVersion!==null))fail()
   const d=(await one(query,'SELECT profitia_requests.location_admission_descriptor() AS descriptor')).descriptor
   if(!d||d.admissionSchemaVersion!=='1.0.0'||d.admissionSchemaDigest!==schemaDigest||['applicationId','environment','role','projectId','branchId','databaseName'].some(k=>d[k]!==b[k]))fail()
   // The receiver MUST lock its actual parent row in this query transaction.
   // No parent flag, org or identifier supplied by an HTTP caller is proof.
   const parent=await readParent({query,actor,request,resource})
   if(!exact(parent,['supplierId','organisationId','collectionId','version'])||parent.supplierId!==e.supplierId||parent.organisationId!==request.organisationId
    ||parent.collectionId!=='supplier-locations:'+e.supplierId||!text(parent.version))fail()
   if(action==='SYNC'&&request.resourceId!==parent.collectionId)fail()
   const t=await one(query,"SELECT txid_current()::text AS transaction_id,floor(extract(epoch FROM clock_timestamp())*1000)::bigint::text AS now_ms")
   const expires=Math.min(Number(t.now_ms)+5000,Date.parse(actor.expiresAt))
   if(!/^[1-9][0-9]*$/.test(t.transaction_id??'')||!Number.isSafeInteger(expires)||expires<=Number(t.now_ms))fail()
   const envelope={contractVersion:'1.0.0',projectId:b.projectId,branchId:b.branchId,databaseName:b.databaseName,schemaDigest,environment:b.environment,applicationId:b.applicationId,role:b.role,transactionId:t.transaction_id,
    operation:request.operation,organisationId:request.organisationId,userId:actor.actorId,resourceId:request.resourceId,payloadDigest:request.payloadDigest,action,evidence:e,parent,expiresAt:expires}
   const canonical=(await one(query,'SELECT $1::jsonb::text AS canonical',[JSON.stringify(envelope)])).canonical
   const signature=createHmac('sha256',key).update(canonical).digest('hex')
   if((await one(query,'SELECT profitia_requests.bind_location_admission($1::jsonb,$2) AS allowed',[JSON.stringify(envelope),signature])).allowed!==true)fail()
   const value=freeze({contractVersion:'1.0.0',schemaDigest,transactionId:t.transaction_id,organisationId:request.organisationId,userId:actor.actorId,
    resourceId:request.resourceId,payloadDigest:request.payloadDigest,operation:request.operation,action,parent})
   admitted.add(value);return value
  },
 })
}
