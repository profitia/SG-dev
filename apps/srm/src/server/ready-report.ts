import {createHash} from 'node:crypto'
import {FINANCIAL_QUALITY_RULE,SCANNER_METHODOLOGY_VERSION,type SupplierReportData,type SupplierXRayCard} from '@profitia/srm-xray'
import {readSharedFinancialSummary} from '@profitia/srm-xray/shared-financial-summary'
import {readCorporatePacket,CORPORATE_PUBLICATION_VERSION} from './corporate-source-store'
import {projectPublicFinancialData} from './corporate-knowledge'
import {projectReportData,type ReportReadRow} from './report-data'
import {qualifyScannerSources,SCANNER_SOURCE_RULE,type ScannerSourceEvidence} from './financial-scanner-source'
import {financialScanner} from './financial-scanner'
import {FINANCIAL_INDICATOR_FORMULA_VERSION,selectedPeriods} from './financial-indicators'
import {FINANCIAL_MAPPING_VERSION,catalogFreshnessMs,isFreshCatalogEntry} from './shared-catalog'
import {COMPANY_IDENTITY_VERSION} from './company-continuity'
import type {FinancialSourceDocument} from './financial-documents'
import {toPublicSection} from './xray-lookup'
import {emptyCard} from '../demo/fixture'
import {isKnownMgbiCompany} from './company-source-policy'

export const PREPARED_REPORT_VERSION='srm-prepared-company-report-v1' as const
export const PREPARED_REPORT_RULES=Object.freeze({mapping:FINANCIAL_MAPPING_VERSION,formula:FINANCIAL_INDICATOR_FORMULA_VERSION,
 identity:COMPANY_IDENTITY_VERSION,quality:FINANCIAL_QUALITY_RULE,scanner:SCANNER_SOURCE_RULE,methodology:SCANNER_METHODOLOGY_VERSION})
type Packet=ReturnType<typeof readCorporatePacket>
export type PreparedReportSources=Readonly<{generalHash:string;financialHash:string;generalEffectId:string;financialEffectId:string}>
export type ReadyDisplayCard={identity:SupplierXRayCard['identity']}&{[K in 'general'|'financial'|'kys']:Omit<SupplierXRayCard[K],'source'>}
export type PreparedCompanyReport=Readonly<{
 version:typeof PREPARED_REPORT_VERSION;nip:string;general:Packet['general'];financial:Packet['financial']
 report:SupplierReportData;scannerEvidence:ScannerSourceEvidence;rules:typeof PREPARED_REPORT_RULES;sources:PreparedReportSources
}>
const refuse=():never=>{throw TypeError('Verified prepared company report required')}
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const sha=/^[a-f0-9]{64}$/
function closed(value:unknown,keys:string[]):value is Record<string,unknown>{
 return !!value&&Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(value).length===keys.length
  &&Object.keys(value).sort().join(',')===[...keys].sort().join(',')
  &&Object.values(Object.getOwnPropertyDescriptors(value)).every(d=>'value'in d&&d.enumerable)
}
const reasons=new Set(['SOURCE_DOCUMENT_UNAVAILABLE','NON_ANNUAL_PERIOD','UNVERIFIED_SOURCE','ACCOUNTING_STANDARD_UNCONFIRMED',
 'UNSUPPORTED_SOURCE_BASIS','SOURCE_REVISION_UNRESOLVED','SOURCE_PERIOD_UNCONFIRMED'])
const suffixes:Record<string,string[]>={
 NET_RESULT:['NET_RESULT','ProfitLoss'],REVENUE:['SALES_AND_EQUIVALENTS','SALES_ONLY','Revenue'],
 OPERATING_MARGIN:['OPERATING_RESULT:SALES_AND_EQUIVALENTS','OPERATING_RESULT:SALES_ONLY','ProfitLossFromOperatingActivities:Revenue'],
 OPERATING_COST_RATIO:['COMPARATIVE_BASIC_OPERATING_COSTS:SALES_AND_EQUIVALENTS','CALCULATION_BASIC_OPERATING_COSTS:SALES_ONLY','ExpenseByNature:Revenue'],
 LIABILITIES_TO_ASSETS:['LIABILITIES_AND_PROVISIONS:TOTAL_ASSETS','Liabilities:Assets'],CURRENT_RATIO:['CURRENT_RATIO','CurrentAssets:CurrentLiabilities'],
}
/** Only derived public corporate facts and fixed methodology labels cross the
 * Source boundary. Private document objects and rows never enter this record. */
function readScannerEvidence(value:unknown,financial:SupplierReportData['financial']):ScannerSourceEvidence{
 const periods=financial.periods,keys=periods.map(p=>`${p.scope}:${p.from}:${p.to}`)
 if(!closed(value,keys))return refuse()
 for(const period of periods){
  const e=value[`${period.scope}:${period.from}:${period.to}`]
  if(!closed(e,['reason','evidenceRef','basis','costs'])||e.reason!==null&&(!reasons.has(e.reason as string))
   ||e.evidenceRef!==null&&(typeof e.evidenceRef!=='string'||!sha.test(e.evidenceRef))
   ||e.costs!==null&&(typeof e.costs!=='string'||!/^\d{1,24}(?:\.\d{1,6})?$/.test(e.costs))
   ||!e.basis||Object.getPrototypeOf(e.basis)!==Object.prototype)return refuse()
  const basis=e.basis as Record<string,unknown>
  if(Reflect.ownKeys(basis).length!==Object.keys(basis).length
   ||Object.values(Object.getOwnPropertyDescriptors(basis)).some(d=>!('value'in d)||!d.enumerable))return refuse()
  const krs=period.sourceRegistration?.krs
  const prefixes=['POLISH_UOR','IAS_IFRS:POSITIONED_XHTML','IAS_IFRS:ESEF/iXBRL'].map(standard=>
   `${standard}:${period.scope}:PLN:${period.from.slice(5)}:${period.to.slice(5)}`+(krs?`:KRS:${krs}`:''))
  for(const[key,entry]of Object.entries(basis)){
   if(!suffixes[key]||typeof entry!=='string'||!prefixes.some(prefix=>suffixes[key].some(suffix=>entry===prefix+':'+suffix)))return refuse()
  }
  if(e.reason!==null&&(e.evidenceRef!==null||Object.keys(basis).length||e.costs!==null))return refuse()
 }
 return structuredClone(value) as ScannerSourceEvidence
}

/** The Source producer prepares this once from its already accepted financial
 * facts/indicators and the organization's authorized document preparation.
 * No database, provider, authorization or publication is performed here. */
export function prepareCompanyReport(input:Readonly<{general:Packet['general'];row:ReportReadRow;
 documents:readonly FinancialSourceDocument[];sources:PreparedReportSources}>,now=new Date(),env:Readonly<Record<string,string|undefined>>={}):PreparedCompanyReport{
 const row=input.row,financial=row.financial_json
 if(!financial||row.kys!==null)return refuse()
 const packet=readCorporatePacket({version:CORPORATE_PUBLICATION_VERSION,nip:row.nip,preserveGeneral:false,
  general:input.general,financial:{status:financial.status,source:financial.source,retrievedAt:financial.retrievedAt,
   effectiveAt:financial.effectiveAt,warnings:financial.warnings,data:projectPublicFinancialData(financial.data)},facts:[]})
 const report=projectReportData({entityType:'COMPANY',nip:row.nip},{...row,scanner_documents:[],kys:null},now,env,{includeScanner:false})
 const scannerEvidence=qualifyScannerSources(report.financial,selectedPeriods(packet.financial.data??{periods:[]}),input.documents,
  report.financial.freshness.retrievedAt??now.toISOString())
 return readPreparedCompanyReport({version:PREPARED_REPORT_VERSION,nip:row.nip,general:packet.general,financial:packet.financial,
  report,scannerEvidence,rules:PREPARED_REPORT_RULES,sources:input.sources})
}

/** Persisted Source bodies are closed at every financial/document boundary;
 * an organization/user, KYS projection, original or arbitrary property fails. */
export function readPreparedCompanyReport(value:unknown):PreparedCompanyReport{
 if(!closed(value,['version','nip','general','financial','report','scannerEvidence','rules','sources'])
  ||value.version!==PREPARED_REPORT_VERSION||typeof value.nip!=='string'||!/^\d{10}$/.test(value.nip))return refuse()
 if(!closed(value.rules,Object.keys(PREPARED_REPORT_RULES))
  ||!closed(value.sources,['generalHash','financialHash','generalEffectId','financialEffectId']))return refuse()
 const rules=value.rules
 if(Object.entries(PREPARED_REPORT_RULES).some(([key,v])=>rules[key]!==v))return refuse()
 const sources=value.sources as Record<string,unknown>
 if(['generalHash','financialHash'].some(k=>typeof sources[k]!=='string'||!sha.test(sources[k] as string))
  ||['generalEffectId','financialEffectId'].some(k=>typeof sources[k]!=='string'||!uuid.test(sources[k] as string)))return refuse()
 const packet=readCorporatePacket({version:CORPORATE_PUBLICATION_VERSION,nip:value.nip,preserveGeneral:false,
  general:value.general,financial:value.financial,facts:[]})
 if(packet.general.source.provider!=='MGBI'||packet.financial.source.provider!=='MGBI'||packet.general.data?.nip!==value.nip)return refuse()
 const report=readSharedFinancialSummary(value.report,{nip:value.nip,entityType:'COMPANY'})
 readScannerEvidence(value.scannerEvidence,report.financial)
 return structuredClone(value) as PreparedCompanyReport
}

/** Human output binds only local preferences/frame identity. It does not read
 * or rebuild source documents, facts, indicators or a private KYS report. */
export function projectPreparedCompanyReport(body:PreparedCompanyReport,scope:Readonly<{organisationId:string;userId:string}>,
 current:Readonly<{generalHash:string;financialHash:string;generalCheckedAt:string|Date;financialCheckedAt:string|Date}>,
 now=new Date(),env:Readonly<Record<string,string|undefined>>={}):Readonly<{card:ReadyDisplayCard;metadata:SupplierReportData}>|null{
 if(!uuid.test(scope.organisationId)||!uuid.test(scope.userId))return refuse()
 const prepared=readPreparedCompanyReport(body),ttl=catalogFreshnessMs(env)
 if(!isKnownMgbiCompany({general:prepared.general,financial:prepared.financial},prepared.nip)
  ||!['SUCCESS','PARTIAL','EMPTY'].includes(prepared.financial.status)
  ||prepared.report.financial.mappingVersion!==FINANCIAL_MAPPING_VERSION)return null
 const data=prepared.financial.data
 if(data&&(data.revisionRule!=='FINANCIAL_REVISIONS_V1'||data.registryHistoryVersion!==COMPANY_IDENTITY_VERSION
  ||data.qualityRule!==FINANCIAL_QUALITY_RULE))return null
 if(prepared.sources.generalHash!==current.generalHash||prepared.sources.financialHash!==current.financialHash
  ||!isFreshCatalogEntry(current.generalCheckedAt,now,ttl)||!isFreshCatalogEntry(current.financialCheckedAt,now,ttl))return null
 const metadata=structuredClone(prepared.report),financial=structuredClone(prepared.financial)
 const missing=new Set(['CALCULATION_NOT_STORED','MAPPING_VERSION_OUTDATED','STORED_EVIDENCE_MISMATCH','INDICATOR_CONTRACT_MISMATCH','INVALID_STORED_VALUE'])
 if(metadata.financial.history.some(series=>series.points.some(point=>point.reasonCode&&missing.has(point.reasonCode))))return null
 metadata.financial.freshness={...metadata.financial.freshness,checkedAt:new Date(current.financialCheckedAt).toISOString(),
  cacheExpiresAt:new Date(new Date(current.financialCheckedAt).getTime()+ttl).toISOString(),freshness:'FRESH'}
 metadata.financial.scanner=financialScanner(metadata.financial,prepared.scannerEvidence,
  {tenantScope:scope.organisationId,asOf:metadata.financial.freshness.retrievedAt??now.toISOString()})
 if(financial.data)financial.data={...financial.data,indicators:metadata.financial.history.flatMap(series=>series.points.map(point=>({
  code:point.code,periodStart:point.periodStart,periodEnd:point.periodEnd,scope:point.scope,status:point.status,value:point.value,
  unit:point.unit,importance:point.importance,reasonCode:point.reasonCode,formulaVersion:point.formulaVersion})))}
 return {card:{identity:{nip:prepared.nip,krs:prepared.general.data?.krs??null,name:prepared.general.data?.legalName??null},
  general:toPublicSection(prepared.general),financial:toPublicSection(financial),kys:toPublicSection(emptyCard.kys)},metadata}
}

export function preparedCompanyReportDigest(value:PreparedCompanyReport):string{return hash(readPreparedCompanyReport(value))}
