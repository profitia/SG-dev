import test from 'node:test'
import assert from 'node:assert/strict'
import {FINANCIAL_QUALITY_RULE,type FinancialData} from '@profitia/srm-xray'
import {prepareCompanyReport,projectPreparedCompanyReport,readPreparedCompanyReport,preparedCompanyReportDigest} from './ready-report'
import {mapMgbiGeneralRecords} from './mgbi-general'
import {FINANCIAL_DOCUMENT_MAPPING_VERSION,type FinancialSourceDocument} from './financial-documents'
import {calculateFinancialIndicators,FINANCIAL_INDICATOR_INPUT_CODES,type CatalogIndicatorFact} from './financial-indicators'
import {projectReportData,type ReportReadRow} from './report-data'
import {FINANCIAL_MAPPING_VERSION} from './shared-catalog'
import {COMPANY_IDENTITY_VERSION} from './company-continuity'

const NIP='8650004194',KRS='0000000001',NOW=new Date('2026-10-28T12:00:00Z'),A='11111111-1111-4111-8111-111111111111',
 B='22222222-2222-4222-8222-222222222222',U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const sources={generalHash:'a'.repeat(64),financialHash:'b'.repeat(64),generalEffectId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',financialEffectId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'}
function fixture(){
 const general=mapMgbiGeneralRecords([{id:'a'.repeat(24),identifiers:{pl_nip:NIP,pl_krs:KRS},content:{current_excerpt:{
  naglowekA:{numerKRS:KRS,dataRejestracjiWKRS:'2001-01-01'},dane:{dzial1:{danePodmiotu:{nazwa:'Synthetic company',formaPrawna:'SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ'}}}}}}],{type:'NIP',value:NIP},'2026-10-28T10:00:00Z').section
 const values:Record<string,string>={PALA_NRFS:'100',PALA_OAC:'80',PALA_PLFS:'20',PALA_NPL:'10',PALA_PLFOA:'15',BS_A_TA:'200',BS_A_CA:'160',BS_LAE_LAPFL_STL:'80',BS_LAE_LAPFL:'100'}
 const facts:ReportReadRow['facts']=[]
 const data:FinancialData={qualityRule:FINANCIAL_QUALITY_RULE,revisionRule:'FINANCIAL_REVISIONS_V1',registryHistoryVersion:COMPANY_IDENTITY_VERSION,
  periods:[2025,2024].map(year=>{
   const from=`${year}-01-01`,to=`${year}-12-31`
   const periodFacts=FINANCIAL_INDICATOR_INPUT_CODES.map((code):CatalogIndicatorFact&{sourceAmount:string}=>({
    metricCode:code,periodStart:from,periodEnd:to,statementScope:'UNIT',amount:values[code]??'100',
    sourceAmount:code==='PALA_OAC'?'-80':values[code]??'100',currencyCode:'PLN',unitCode:'PLN',sourcePath:'PRIVATE_PROVIDER_PATH.'+code,
    validationStatus:'VALID',normalizationRule:code==='PALA_OAC'||code==='PALA_COGS'?'VERIFIED_COST_MAGNITUDE_V1':'SOURCE_VALUE',sourceSnapshotId:sources.financialEffectId}))
   facts.push(...periodFacts)
   return{from,to,scope:'standalone',documentId:'record:'+(year===2025?'cfy':'pfy'),accountingStandard:'POLISH_UOR',revisionStatus:'RESOLVED',
    sourceRegistration:{krs:KRS,legalName:'Synthetic company',relationship:'CURRENT'},xmlSchema:{name:'JednostkaInnaWZlotych',version:'1-0E'},
    facts:periodFacts.map(f=>({metricCode:f.metricCode,amount:f.amount,currency:'PLN',unit:'PLN'}))}
  })}
 const row:ReportReadRow={nip:NIP,financial_json:{status:'SUCCESS',source:{provider:'MGBI',model:'pl-krs-rdf-record',recordId:'b'.repeat(24)},data,
  retrievedAt:'2026-10-28T10:00:00Z',effectiveAt:'2025-12-31',warnings:[],catalogMappingVersion:FINANCIAL_MAPPING_VERSION},
  financial_sha256:sources.financialHash,financial_checked_at:'2026-10-28T10:00:00Z',facts,indicators:calculateFinancialIndicators(NIP,data,facts),kys:null}
 const paths:Record<string,string>={PALA_NRFS:'RZiS.RZiSPor.A',PALA_OAC:'RZiS.RZiSPor.B',PALA_PLFS:'RZiS.RZiSPor.C',PALA_NPL:'RZiS.RZiSPor.L',PALA_PLFOA:'RZiS.RZiSPor.F',
  BS_A_TA:'Bilans.Aktywa',BS_A_CA:'Bilans.Aktywa.Aktywa_B',BS_LAE_LAPFL:'Bilans.Pasywa.Pasywa_B',BS_LAE_LAPFL_STL:'Bilans.Pasywa.Pasywa_B.Pasywa_B_III'}
 const documents:FinancialSourceDocument[]=[{recordId:'record',documentId:'document',sourceKrs:KRS,scope:'standalone',from:'2025-01-01',to:'2025-12-31',
  standard:'POLISH_UOR',isIasCompliant:false,standardBasis:'MGBI_DOCUMENT_FLAG_AND_POLISH_XML_SCHEMA',provider:'MGBI',model:'pl-krs-rdf-record',format:'XML',availability:'XML_SUPPORTED',formatBasis:'XML',
  schemaName:'JednostkaInnaWZlotych',schemaVersion:'1-0E',currency:'PLN',scale:'1',correction:false,filingDate:'2026-07-15',checksum:'e'.repeat(64),
  mappingVersion:FINANCIAL_DOCUMENT_MAPPING_VERSION,validation:'VALID',columns:[],rows:Object.entries(paths).map(([code,path])=>({section:path.startsWith('RZiS')?'RZiS':'Bilans',sourcePath:path,
   label:'PRIVATE_DOCUMENT_LABEL',depth:2,amounts:{KwotaA:code==='PALA_OAC'?'-80':values[code],KwotaB:code==='PALA_OAC'?'-80':values[code]}}))}]
 const current={generalHash:sources.generalHash,financialHash:sources.financialHash,generalCheckedAt:'2026-10-28T10:00:00Z',financialCheckedAt:'2026-10-28T10:00:00Z'}
 return{general,row,documents,current,prepare:()=>prepareCompanyReport({general,row,documents,sources},NOW)}
}
test('prepared report retains identical financial facts, indicators and qualified radar without retaining private documents',()=>{
 const f=fixture(),body=f.prepare(),result=projectPreparedCompanyReport(body,{organisationId:A,userId:U},f.current,NOW)!
 assert(result);assert.equal(result.card.identity.nip,NIP)
 const baseline=projectReportData({nip:NIP,entityType:'COMPANY'},{...f.row,scanner_documents:f.documents,scannerTenantScope:A},NOW,{})
 assert.deepEqual(result.metadata.financial,baseline.financial)
 assert(body.scannerEvidence['standalone:2025-01-01:2025-12-31'].basis.REVENUE)
 assert(result.metadata.financial.scanner?.periods.length)
 const text=JSON.stringify(body)
 for(const marker of ['PRIVATE_PROVIDER_PATH','PRIVATE_DOCUMENT_LABEL','scanner_documents','sourceSnapshotId','sourcePath','preferenceScope','locationSubject'])assert(!text.includes(marker),marker)
 assert.equal(body.report.kys.status,'NOT_REQUESTED');assert.equal(body.report.financial.scanner,undefined)
 assert.match(preparedCompanyReportDigest(body),/^[a-f0-9]{64}$/)
})
test('source values are detached and cannot be mutated through a returned report',()=>{
 const f=fixture(),body=f.prepare(),before=preparedCompanyReportDigest(body),result=projectPreparedCompanyReport(body,{organisationId:A,userId:U},f.current,NOW)!
 result.card.identity.name='changed';result.metadata.financial.history[0].points[0].value='99999'
 assert.equal(preparedCompanyReportDigest(body),before)
})
test('each organization keeps its own scanner frame identity with identical public numeric results',()=>{
 const f=fixture(),body=f.prepare(),a=projectPreparedCompanyReport(body,{organisationId:A,userId:U},f.current,NOW)!,b=projectPreparedCompanyReport(body,{organisationId:B,userId:U},f.current,NOW)!
 assert.deepEqual(a.metadata.financial.history,b.metadata.financial.history)
 assert.notDeepEqual(a.metadata.financial.scanner?.referenceFrames?.map(f=>f.id),b.metadata.financial.scanner?.referenceFrames?.map(f=>f.id))
})
for(const[key,change]of [
 ['generalHash',{generalHash:'f'.repeat(64)}],['financialHash',{financialHash:'f'.repeat(64)}],
 ['expired general',{generalCheckedAt:'2026-10-01'}],['expired financial',{financialCheckedAt:'2026-10-01'}],
 ['future check',{financialCheckedAt:'2027-01-01'}],
] as const)test('READY excludes '+key+' rather than reconstructing or fetching providers',()=>{
 const f=fixture();assert.equal(projectPreparedCompanyReport(f.prepare(),{organisationId:A,userId:U},{...f.current,...change},NOW),null)
})
test('an immediate shorter cache policy takes effect without rewriting source observations',()=>{
 const f=fixture(),body=f.prepare();assert.equal(projectPreparedCompanyReport(body,{organisationId:A,userId:U},f.current,new Date('2026-10-29T11:00:00Z'),{SRM_MGBI_CACHE_TTL_HOURS:'24'}),null)
 assert.equal(body.report.financial.freshness.checkedAt,'2026-10-28T10:00:00.000Z')
})
for(const key of ['organisationId','userId','privateReport','originalResponse'])test('persisted prepared Source refuses extra '+key,()=>{
 const f=fixture();assert.throws(()=>readPreparedCompanyReport({...f.prepare(),[key]:'private-value'}))
})
test('financial and scanner source boundaries reject private or fabricated nested content',()=>{
 const f=fixture(),body=f.prepare(),bad=structuredClone(body) as unknown as Record<string,any>
 bad.report.financial.periods[0].facts[0].sourcePath='private';assert.throws(()=>readPreparedCompanyReport(bad))
 const forged=structuredClone(body);forged.scannerEvidence['standalone:2025-01-01:2025-12-31'].basis.REVENUE='private:another-organization'
 assert.throws(()=>readPreparedCompanyReport(forged))
 const wrong=structuredClone(body);wrong.scannerEvidence['standalone:2025-01-01:2025-12-31'].basis.REVENUE='POLISH_UOR:standalone:PLN:01-01:12-31:KRS:9999999999:SALES_AND_EQUIVALENTS'
 assert.throws(()=>readPreparedCompanyReport(wrong))
})
test('missing stored calculations do not become an apparent complete READY report',()=>{
 const f=fixture();f.row.indicators=[]
 assert.equal(projectPreparedCompanyReport(f.prepare(),{organisationId:A,userId:U},f.current,NOW),null)
})
