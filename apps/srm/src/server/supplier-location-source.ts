import type {PoolClient} from 'pg'
import type {GeneralCompanyData,SectionEnvelope,LocationSource,VerclyKysData} from '@profitia/srm-xray'
import {readArchivedCompanyGeneral} from './company-general-cache'
import {mgbiStructuredLocationAddress,type AcceptedCompanyAddress} from './supplier-location-sync'

export type AcceptedKysLocations=Readonly<{source:LocationSource;entities:NonNullable<VerclyKysData['relatedEntities']>}>
/** Runs only inside an admitted HUMAN location operation. SQL checks the
 * source's own current grant; it never acquires or refreshes a provider report. */
export async function readLocationCompany(client:PoolClient,org:string,supplierId:string,nip:string):Promise<AcceptedCompanyAddress|null>{
 const row=(await client.query<{general_json:SectionEnvelope<GeneralCompanyData>;general_sha256:string}>(`SELECT general_json,general_sha256 FROM srm.catalog_companies
 WHERE nip=$1 AND profitia_requests.location_permission('srm',$2::uuid,nullif(current_setting('profitia.user_id',true),'')::uuid,'supplier.report.read','supplier-report:COMPANY:'||nip)`,[nip,org])).rows[0]
 const section=row?.general_json,krs=section?.data?.krs
 if(!section?.data||!section.retrievedAt||!krs||!/^[a-f0-9]{64}$/.test(row.general_sha256))return null
 let structuredAddress=null
 // The archive reader verifies checksum, legal identity and bounded records.
 // If absent or older, keep the accepted display address without guessing parts.
 const archived=await readArchivedCompanyGeneral(client,org,nip)
 if(archived?.section.data?.krs===krs&&archived.section.data.registeredAddress===section.data.registeredAddress)
  structuredAddress=mgbiStructuredLocationAddress(archived.rawRecord)
 return {supplierId,nip,krs,section,structuredAddress,source:{kind:'MGBI',reportId:'MGBI:'+nip+':'+row.general_sha256,version:row.general_sha256,
  retrievedAt:section.retrievedAt,effectiveAt:section.effectiveAt,retentionUntil:null}}
}
export function acceptedKysLocations(value:unknown,nip:string,now=Date.now()):AcceptedKysLocations|null{
 if(!value||typeof value!=='object')return null
 const v=value as {section?:SectionEnvelope<VerclyKysData>;privateReport?:{snapshotId:string;nip:string;entityType:string;retentionUntil:string}}
 const m=v.privateReport,s=v.section
 if(!m||m.nip!==nip||m.entityType!=='COMPANY'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(m.snapshotId)||!Number.isFinite(Date.parse(m.retentionUntil))||Date.parse(m.retentionUntil)<=now
  ||!s?.retrievedAt||s.source!==undefined&&s.source.provider!=='VERCLY'||!['SUCCESS','PARTIAL'].includes(s.status)||!Array.isArray(s.data?.relatedEntities)||s.data.relatedEntities.length>2000)return null
 // Explicit allowlist: personal lists, tokens and arbitrary KYS body are dropped.
 const entities=s.data.relatedEntities.map(v=>({name:v.name,role:v.role,krs:v.krs,nip:v.nip,regon:v.regon,relationshipStart:v.relationshipStart,relationshipEnd:v.relationshipEnd,stakeDescription:null,sanctionsMatch:null}))
 return {source:{kind:'KYS',reportId:m.snapshotId,version:m.snapshotId,retrievedAt:s.retrievedAt,effectiveAt:s.effectiveAt,retentionUntil:m.retentionUntil},entities}
}
