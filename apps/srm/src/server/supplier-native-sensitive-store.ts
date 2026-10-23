import type {PoolClient} from 'pg'
import {OperationDenied,operationPayloadDigest,type Json} from '@profitia/platform-contracts/operation-context'
import {jdgDeregistration,type JdgRegistryData,type SectionEnvelope,type VerclyKysData} from '@profitia/srm-xray'
import {bindOrganizationTransaction,withOrganization,type DatabasePool} from './db'
import {createLookup,startAttempt,appendSnapshot,appendSectionProjection,finishAttempt,type SnapshotInput,type TerminalStatus} from './xray-repository'
import {persistSection} from './xray-lookup'
import {readSupplierRegistrationStatus} from './company-activity'
import {createOrganisationKysCacheStore,purgeOrganisationKysCache,type KysCacheStore,type KysSection,type KysEntityType} from './kys-cache'
import {readSupplierRequest} from './supplier-request-operation'
import type {SupplierNativeWork,SupplierNativeWorkSelection,SupplierSensitiveWorkUnit} from './supplier-request-work'

export const SENSITIVE_NATIVE_STORE_VERSION='srm-sensitive-native-store-v1'
const refuse=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
// Readonly domain arrays are still finite JSON; the canonical validator owns hashing.
const digest=(value:unknown)=>operationPayloadDigest(value as Json)
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
function copy<T>(value:T):T{
 const text=JSON.stringify(value,(_key,v)=>{if(typeof v==='number'&&!Number.isFinite(v))return refuse();return v})
 if(!text||Buffer.byteLength(text)>32*1024*1024)return refuse()
 const v=JSON.parse(text);operationPayloadDigest(v as Json);return freeze(v) as T
}
function selection(value:SupplierNativeWorkSelection):SupplierNativeWorkSelection{
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==3
  ||Object.keys(value).sort().join(',')!=='command,organisationId,requestId'
  ||Object.values(Object.getOwnPropertyDescriptors(value)).some(d=>!('value'in d)||!d.enumerable))return refuse()
 return freeze({...value,command:readSupplierRequest(value.command)})
}

/** The original domain writers under current native Work. No network, shared
 * publication, alternate ledger or unscoped connection belongs in this store. */
export function createSrmSensitiveNativeStore(options:{work:Readonly<SupplierNativeWork>;entityType:KysEntityType;section:'jdg'|'kys'}){
 if(typeof window!=='undefined'||!options||Object.keys(options).sort().join(',')!=='entityType,section,work'
  ||typeof options.work?.run!=='function'||!['COMPANY','JDG'].includes(options.entityType)
  ||!['jdg','kys'].includes(options.section)||options.section==='jdg'&&options.entityType!=='JDG')throw TypeError('Explicit sensitive store selection required')
 const work=options.work,entityType=options.entityType,section=options.section
 async function run<T>(input:SupplierNativeWorkSelection,unit:SupplierSensitiveWorkUnit,body:Json,
  action:(pool:DatabasePool,client:PoolClient)=>Promise<T>):Promise<T>{
  const s=selection(input);let value:T|undefined,entered=false
  try{
   const receipt=await work.run(s,unit,{version:SENSITIVE_NATIVE_STORE_VERSION,nip:s.command.nip,entityType,section,body},async(context,client)=>{
    if(entered)return refuse();entered=true
    const output=await action(bindOrganizationTransaction(s.organisationId,client,context),client)
    value=output===undefined?output:copy(output)
   })
   if(!entered||receipt.requestId!==s.requestId||receipt.unitId!==unit||receipt.status!=='ACCEPTED')return refuse()
   return value as T
  }finally{value=undefined}
 }
 return Object.freeze({
  // Register this exact accepted lookup without touching an existing supplier.
  // UPDATE has independent RLS purposes and is not needed for CEIDG or KYS.
  register(input:SupplierNativeWorkSelection){const s=selection(input);return run(s,'SRM_SENSITIVE_REGISTER',null,pool=>
   createLookup(s.organisationId,{type:'NIP',value:s.command.nip},entityType,pool,s.requestId,'KEEP'))},
  status(input:SupplierNativeWorkSelection){const s=selection(input);return run(s,'SRM_SENSITIVE_STATUS',null,async(pool,client)=>{
   if(entityType==='COMPANY')return readSupplierRegistrationStatus(s.organisationId,s.command.nip,entityType,pool)
   const data=(await client.query<{data:JdgRegistryData|null}>('SELECT srm.private_jdg_activity_metadata($1::uuid,$2) AS data',[s.organisationId,s.command.nip])).rows[0]?.data
   return jdgDeregistration(data).deregistered?'DEREGISTERED' as const:'UNKNOWN' as const
  })},
  purge(input:SupplierNativeWorkSelection){const s=selection(input);return run(s,'SRM_SENSITIVE_PURGE',null,async(pool,client)=>{
   // Physical expiry is restricted to this organization and these two classes.
   await client.query("DELETE FROM srm.section_projections WHERE organization_id=$1::uuid AND snapshot_id IN(SELECT id FROM srm.source_snapshots WHERE organization_id=$1::uuid AND data_class IN('KYS_PERSONAL','JDG_REGISTRY') AND retention_until<=clock_timestamp())",[s.organisationId])
   await client.query("DELETE FROM srm.source_snapshots WHERE organization_id=$1::uuid AND data_class IN('KYS_PERSONAL','JDG_REGISTRY') AND retention_until<=clock_timestamp()",[s.organisationId])
   await purgeOrganisationKysCache(s.organisationId,pool)
  })},
  replay(input:SupplierNativeWorkSelection){const s=selection(input);return run(s,'SRM_SENSITIVE_REPLAY',null,async(_pool,client)=>{
   const rows=(await client.query<{snapshotId:string|null;status:string;completedAt:string|null;errorCode:string|null;retentionUntil:string|null;envelope:SectionEnvelope<JdgRegistryData|VerclyKysData>|null}>(
    `SELECT v.id::text AS "snapshotId",a.status,a.completed_at::text AS "completedAt",a.error_code AS "errorCode",v.retention_until::text AS "retentionUntil",p.private_envelope AS envelope
     FROM srm.provider_attempts a JOIN srm.lookup_requests l ON l.organization_id=a.organization_id AND l.id=a.request_id
     LEFT JOIN srm.source_snapshots v ON v.organization_id=a.organization_id AND v.attempt_id=a.id AND v.supplier_id=l.supplier_id AND v.section=a.section
     LEFT JOIN srm.section_projections p ON p.organization_id=v.organization_id AND p.snapshot_id=v.id AND p.supplier_id=v.supplier_id AND p.section=v.section
     WHERE a.organization_id=$1::uuid AND a.request_id=$2::uuid AND a.section=$3 AND l.identifier=$4 AND l.entity_type=$5
     ORDER BY p.projection_version DESC LIMIT 2`,[s.organisationId,s.requestId,section,s.command.nip,entityType])).rows
   if(!rows.length)return null
   if(rows.length===1&&rows[0].completedAt&&['NO_DATA','ERROR','TIMEOUT'].includes(rows[0].status)&&!rows[0].snapshotId&&!rows[0].envelope)return rows[0]
   if(rows.length!==1||!rows[0].envelope||!rows[0].snapshotId||!rows[0].retentionUntil
    ||!['SUCCESS','ERROR'].includes(rows[0].status)||Date.parse(rows[0].retentionUntil)<=Date.now())throw new OperationDenied('DELIVERY_UNCERTAIN')
   return rows[0]
  })},
  startJdg(input:SupplierNativeWorkSelection){const s=selection(input);if(section!=='jdg')return refuse();return run(s,'SRM_JDG_START',null,pool=>startAttempt(s.organisationId,s.requestId,'jdg',1,'PROVIDER',pool))},
  snapshotJdg(input:SupplierNativeWorkSelection,value:SnapshotInput){
   const s=selection(input);if(section!=='jdg'||value.section!=='jdg'||value.dataClass!=='JDG_REGISTRY')return refuse()
   const body=copy({...value,retrievedAt:value.retrievedAt.toISOString(),retentionUntil:value.retentionUntil?.toISOString(),effectiveAt:value.effectiveAt?.toISOString()})
   const records=(body.payload as {firma?:unknown[]})?.firma
   if(!Array.isArray(records)||records.some(v=>!v||typeof v!=='object'||(v as {wlasciciel?:{nip?:unknown}}).wlasciciel?.nip!==s.command.nip))return refuse()
   return run(s,'SRM_JDG_STORE',{bodyDigest:digest(body)},pool=>appendSnapshot(s.organisationId,{...body,
    retrievedAt:new Date(body.retrievedAt),retentionUntil:body.retentionUntil?new Date(body.retentionUntil):undefined,
    effectiveAt:body.effectiveAt?new Date(body.effectiveAt):undefined},pool))
  },
  projectJdg(input:SupplierNativeWorkSelection,value:Parameters<typeof appendSectionProjection>[1],envelope:SectionEnvelope<JdgRegistryData>){
   const s=selection(input),body=copy({...value,privateEnvelope:envelope});if(section!=='jdg'||body.section!=='jdg')return refuse()
   return run(s,'SRM_JDG_STORE',{bodyDigest:digest(body)},pool=>appendSectionProjection(s.organisationId,body,pool))
  },
  finishJdg(input:SupplierNativeWorkSelection,attemptId:string,status:TerminalStatus,details:Parameters<typeof finishAttempt>[3]){
   const s=selection(input),body=copy({attemptId,status,details});if(section!=='jdg')return refuse()
   return run(s,'SRM_JDG_FINISH',{bodyDigest:digest(body)},pool=>finishAttempt(s.organisationId,body.attemptId,body.status,body.details,pool))
  },
  storeKys(input:SupplierNativeWorkSelection,lookup:{supplierId:string;requestId:string},envelope:KysSection,errorCode:string|null,correlationId:string|null,method:'PROVIDER'|'CACHE'){
   const s=selection(input),body=copy({lookup,envelope,errorCode,correlationId,method})
   if(section!=='kys'||body.lookup.requestId!==s.requestId||body.envelope.source.provider!=='VERCLY'||!['PROVIDER','CACHE'].includes(method))return refuse()
   return run(s,'SRM_KYS_STORE',{bodyDigest:digest(body)},pool=>persistSection(s.organisationId,body.lookup,'kys',body.envelope,body.errorCode,[],body.correlationId,undefined,body.method,pool,true))
  },
  cache(input:SupplierNativeWorkSelection){
   const s=selection(input);if(section!=='kys')return refuse();let lease:string|null=null,armed=false
   const check=(org:string,nip:string,entity:KysEntityType)=>{if(org!==s.organisationId||nip!==s.command.nip||entity!==entityType)return refuse()}
   const owned=(owner:string)=>{if(!lease||owner!==lease)return refuse()}
   const store:KysCacheStore={
    read:async(org,nip,entity,at)=>{check(org,nip,entity);const now=new Date(at.getTime());return run(s,'SRM_KYS_CACHE_READ',{at:now.toISOString()},pool=>createOrganisationKysCacheStore(org,pool).read(org,nip,entity,now))},
    claim:async(org,nip,entity,at)=>{check(org,nip,entity);if(lease)return refuse();const now=new Date(at.getTime());lease=await run(s,'SRM_KYS_CACHE_CLAIM',{at:now.toISOString()},pool=>createOrganisationKysCacheStore(org,pool).claim(org,nip,entity,now));return lease},
    save:async(org,nip,entity,owner,envelope,snapshot)=>{check(org,nip,entity);owned(owner);if(!armed)return refuse();const body=copy(envelope)
     await run(s,'SRM_KYS_CACHE_SAVE',{owner,bodyDigest:digest(body),snapshot},pool=>createOrganisationKysCacheStore(org,pool).save(org,nip,entity,owner,body,snapshot));lease=null},
    hold:async(org,nip,entity,owner)=>{check(org,nip,entity);owned(owner);await run(s,'SRM_KYS_CACHE_HOLD',{owner},pool=>createOrganisationKysCacheStore(org,pool).hold(org,nip,entity,owner));armed=true},
    renew:async(org,nip,entity,owner,at)=>{check(org,nip,entity);owned(owner);const now=new Date(at.getTime());return run(s,'SRM_KYS_CACHE_RENEW',{owner,at:now.toISOString()},pool=>createOrganisationKysCacheStore(org,pool).renew(org,nip,entity,owner,now))},
    release:async(org,nip,entity,owner)=>{check(org,nip,entity);owned(owner);await run(s,'SRM_KYS_CACHE_RELEASE',{owner},pool=>createOrganisationKysCacheStore(org,pool).release(org,nip,entity,owner));lease=null},
   }
   return Object.freeze({store:Object.freeze(store),async arm(){if(!lease)return refuse();await store.hold(s.organisationId,s.command.nip,entityType,lease)},
    async releaseUnsent(){if(lease)await store.release(s.organisationId,s.command.nip,entityType,lease)}})
  },
 })
}
