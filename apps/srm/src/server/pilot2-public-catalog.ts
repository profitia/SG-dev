import type {PoolClient} from 'pg'
import type {FinancialData,GeneralCompanyData,SectionEnvelope,SupplierXRayCard} from '@profitia/srm-xray'
import {OperationDenied,operationPayloadDigest,type Json} from '@profitia/platform-contracts/operation-context'
import {isFreshCatalogEntry,isCurrentFinancialMapping} from './shared-catalog'
import {readCorporateCompanyData,readCorporateFinancialData,projectPublicFinancialData} from './corporate-knowledge'
import {readyPilot2RegistryReport} from './pilot2-registry'
import {emptyCard} from '../demo/fixture'
import {readSupplierRequest} from './supplier-request-operation'

type Query=Pick<PoolClient,'query'>
type General=SectionEnvelope<GeneralCompanyData>
type Financial=SectionEnvelope<FinancialData>&{catalogMappingVersion?:string}
export type Pilot2PublicCardRow={general_json:General|null;financial_json:Financial|null;
 general_checked_at:Date|string|null;financial_checked_at:Date|string|null}
export const PILOT2_PUBLIC_CARD_SQL=`SELECT general_json,financial_json,general_checked_at,financial_checked_at
 FROM srm.catalog_companies WHERE nip=$1`
const deny=():never=>{throw new OperationDenied('POLICY_UNAVAILABLE')}

/** A separate ordinary read-only login sees only the three public catalog
 * tables. It never reads the cloned tenant's archives, lookup history, users,
 * documents, interests or KYS. The caller supplies the canonical HUMAN host;
 * this reader neither authenticates nor returns an authorization decision. */
export async function readPilot2PublicCard(client:Query,inputNip:string,now=new Date()):Promise<Readonly<{card:SupplierXRayCard;version:string;bodyDigest:string}>|null>{
 const nip=readSupplierRequest({kind:'SUPPLIER_REPORT',nip:inputNip}).nip
 const row=(await client.query<Pilot2PublicCardRow>(PILOT2_PUBLIC_CARD_SQL,[nip])).rows[0]
 return classifyPilot2PublicCard(row,nip,now)
}
/** Identical field/freshness classifier for an already scoped native row. */
export function classifyPilot2PublicCard(row:Pilot2PublicCardRow|undefined,nip:string,now=new Date()){
 readSupplierRequest({kind:'SUPPLIER_REPORT',nip})
 if(!row?.general_json?.data||!row.financial_json
  ||!isFreshCatalogEntry(row.general_checked_at,now)||!isFreshCatalogEntry(row.financial_checked_at,now)
  ||!isCurrentFinancialMapping(row.financial_json))return null
 if(!readyPilot2RegistryReport({general:row.general_json,financial:row.financial_json},nip))return null
 const {catalogMappingVersion:_,...financial}=row.financial_json
 const {registrySource,...company}=row.general_json.data
 if(!registrySource||Object.keys(registrySource).sort().join(',')!=='coverage,evidenceRef,provider,retrievedAt'
  ||registrySource.provider!=='KRS'||registrySource.coverage!=='PROGRESSIVE'
  ||registrySource.retrievedAt!==row.general_json.retrievedAt
  ||registrySource.evidenceRef!==row.general_json.source.recordId)return deny()
 // Reuse the accepted field classifiers, not the stored MGBI General packet.
 // KRS keeps its real provider/model/evidence and is never relabelled MGBI.
 for(const section of [row.general_json,financial]){
  if(Object.keys(section).sort().join(',')!=='data,effectiveAt,retrievedAt,source,status,warnings'
   ||Object.keys(section.source).sort().join(',')!=='model,provider,recordId'
   ||!Array.isArray(section.warnings)||section.warnings.length>16384
   ||section.warnings.some(w=>typeof w!=='string'||w.length>4096||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(w))
   ||section.effectiveAt!==null&&(!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z)?$/.test(section.effectiveAt)||!Number.isFinite(Date.parse(section.effectiveAt))))return deny()
 }
 if(row.general_json.source.model!=='OdpisAktualny'||financial.source.model!=='pl-krs-rdf-record'
  ||financial.source.recordId!==null&&!/^[a-f0-9]{24}$/.test(financial.source.recordId))return deny()
 for(const [section,checked]of [[row.general_json,row.general_checked_at],[financial,row.financial_checked_at]]as const){
  const time=section.retrievedAt
  if(!time||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(time)||!Number.isFinite(Date.parse(time))
   ||new Date(time).toISOString().slice(0,10)!==time.slice(0,10)||Date.parse(time)>new Date(checked!).getTime())return deny()
 }
 const classified=readCorporateCompanyData(company,nip);if(!classified)return deny()
 const general={...row.general_json,data:{...classified,registrySource:{...registrySource}}}
 const publicFinancial={...financial,data:readCorporateFinancialData(projectPublicFinancialData(financial.data))}
 const card:SupplierXRayCard={identity:{nip,krs:general.data.krs??null,name:general.data.legalName??null},
  general,financial:publicFinancial,kys:structuredClone(emptyCard.kys)}
 const bodyDigest=operationPayloadDigest(card as unknown as Json)
 // Original upsert keeps the old payload when its content is unchanged while
 // a successful provider recheck advances checked_at. Preserve that rule and
 // bind report freshness to the resource version without renewing it on reads.
 return Object.freeze({card,bodyDigest,version:operationPayloadDigest({bodyDigest,
  generalCheckedAt:new Date(row.general_checked_at!).toISOString(),financialCheckedAt:new Date(row.financial_checked_at!).toISOString()})})
}
