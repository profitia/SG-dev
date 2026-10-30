
import {diagnosticRun} from './diagnostic-trace'
import { createHash } from 'node:crypto'
import type { PoolClient } from 'pg'
import { OperationDenied, operationPayloadDigest, type Json, type OperationContext } from '@profitia/platform-contracts/operation-context'
import { bindOrganizationTransaction, withOrganization, type DatabasePool } from './db'
import { readSupplierRequest } from './supplier-request-operation'
import type { SupplierNativeWork, SupplierNativeWorkSelection, SupplierNativeWorkUnit } from './supplier-request-work'
import { createLookup, type ExistingSupplierRegistration } from './xray-repository'
import { persistSection } from './xray-lookup'
import { readFreshCompany, isFreshCatalogEntry,isCurrentFinancialMapping,readIndicatorPublication, readStoredIndicatorFacts, projectStoredIndicators, recordSupplierInterest } from './shared-catalog'
import { FINANCIAL_INDICATOR_INPUT_CODES, type CatalogIndicatorFact } from './financial-indicators'
import { readCompanyRegistration } from './company-activity'
import { enrichCompanyPkd } from './company-pkd'
import { reprojectFinancialArchive, type FinancialSourceFact } from './mgbi-financial'
import { saveMgbiArchive } from './mgbi-archive'
import { applyFinancialDocumentMetadata, financialRecordsFromPages, readFinancialDocuments, readPreparedFinancialDocuments, saveFinancialDocuments } from './financial-documents'
import type {MgbiGeneralResult} from './mgbi-general'
import type {MgbiFinancialResult} from './mgbi-financial'
import {isCompanyReportRestricted} from '@profitia/srm-xray'
import {isKnownMgbiCompany} from './company-source-policy'
import { msrStore, type MsrReceipt, type MsrStore } from './msr-repository'
import type { MsrCandidate } from './msr-financial'
import type { MsrOriginal } from './msr-source'
import type { FinancialData, GeneralCompanyData, SectionEnvelope } from '@profitia/srm-xray'

export const SUPPLIER_NATIVE_STORE_VERSION='srm-supplier-native-work-v1'
const MAX_JSON_BYTES=32*1024*1024,MAX_ORIGINAL_BYTES=20*1024*1024,MAX_EXPANDED_BYTES=50*1024*1024
const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex')
const refuse=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
// Domain declarations expose readonly arrays; the same canonical runtime
// validator accepts their finite JSON values without making them mutable.
// Payload evidence only: keys are our own deeply frozen copies, never caller
// objects, identities or authority observations. Weak keys do not retain them.
const capturedDigests=new WeakMap<object,string>()
const digest=(value:unknown)=>value&&typeof value==='object'
  ?capturedDigests.get(value)??operationPayloadDigest(value as Json):operationPayloadDigest(value as Json)

/** Only complete structured evidence can skip the separate MSR inventory.
 * Unknown/error/IAS results keep the original path; no missing value is proof
 * of a supported financial report. This predicate grants no authority. */
export function isStructuredFreshCompany(nip:string,g:MgbiGeneralResult,f:MgbiFinancialResult):boolean{
  if(g.errorCode!==null||f.errorCode!==null||!['SUCCESS','PARTIAL'].includes(g.section.status)||f.section.status!=='SUCCESS'
    ||g.section.source.provider!=='MGBI'||f.section.source.provider!=='MGBI'
    ||!isKnownMgbiCompany({general:g.section,financial:f.section},nip)||isCompanyReportRestricted(g.section.data)
    ||!f.section.data||!g.rawResponse||!f.rawResponse||!g.section.retrievedAt||!f.section.retrievedAt)return false
  for(const value of [g,f]){
    const raw=value.rawResponse!
    if(!Array.isArray(raw.pages)||raw.pages.length<1||!Number.isSafeInteger(raw.recordCount)||raw.recordCount<1
      ||raw.pages.some(page=>!page||typeof page!=='object'||!Array.isArray((page as {results?:unknown}).results)))return false
    const records=financialRecordsFromPages(raw.pages)
    if(records.length!==raw.recordCount||records.some(record=>!record||typeof record!=='object'
      ||(record as {identifiers?:{pl_nip?:unknown}}).identifiers?.pl_nip!==nip))return false
  }
  return !financialRecordsFromPages(f.rawResponse.pages).some(record=>(record as {document?:{is_ias_compliant?:unknown}}).document?.is_ias_compliant===true)
}
function json<T>(value:T):T{
 return diagnosticRun('JSON_CAPTURE',()=>{
  let text:string|undefined
  try{text=JSON.stringify(value,(_key,v)=>{if(typeof v==='number'&&!Number.isFinite(v))return refuse();return v})}catch{return refuse()}
  if(!text||Buffer.byteLength(text)>MAX_JSON_BYTES)return refuse()
  const captured=JSON.parse(text) as T
  const checksum=operationPayloadDigest(captured as Json)
  const frozen=freeze(captured)
  if(frozen&&typeof frozen==='object')capturedDigests.set(frozen,checksum)
  return frozen

 })
}
function select(value:SupplierNativeWorkSelection):SupplierNativeWorkSelection{
  if(!value||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==3
    ||Object.keys(value).sort().join(',')!=='command,organisationId,requestId'
    ||Object.values(Object.getOwnPropertyDescriptors(value)).some(d=>!('value'in d)||!d.enumerable))return refuse()
  return freeze({...value,command:readSupplierRequest(value.command)})
}
function original(value:MsrOriginal,candidate:MsrCandidate):MsrOriginal{
  if(!value||value.recordId!==candidate.recordId||!Buffer.isBuffer(value.bytes)||value.bytes.length>MAX_ORIGINAL_BYTES
    ||value.checksum!==hash(value.bytes)||!['XHTML','XBRL'].includes(value.format)||!['ZIP','DOCUMENT'].includes(value.container)
    ||typeof value.retrievedAt!=='string'||!Number.isFinite(Date.parse(value.retrievedAt))||!Array.isArray(value.files))return refuse()
  let expanded=0
  const files=value.files.map(file=>{
    if(!file||typeof file.name!=='string'||typeof file.text!=='string'||typeof file.checksum!=='string')return refuse()
    expanded+=Buffer.byteLength(file.text);if(expanded>MAX_EXPANDED_BYTES)return refuse()
    return {...file}
  })
  // Text is immutable; bytes get a private copy before any await. The original
  // writer still owns durable receipt state and original/projection integrity.
  return {...value,bytes:Buffer.from(value.bytes),files}
}
function receipt(value:MsrReceipt|null):MsrReceipt|null{
  if(value===null)return null
  if(!value||!['REQUESTED','RECEIVED','READY','BLOCKED','DEFERRED'].includes(value.state)
    ||!/^[a-f0-9]{64}$/.test(value.identity_sha256)||typeof value.claim_id!=='string')return refuse()
  const bytes=value.original_bytes
  if(bytes!==null&&(!Buffer.isBuffer(bytes)||bytes.length>MAX_ORIGINAL_BYTES||hash(bytes)!==value.original_sha256))return refuse()
  if(value.parsed_text!==null&&(typeof value.parsed_text!=='string'||Buffer.byteLength(value.parsed_text)>MAX_JSON_BYTES))return refuse()
  return {...value,original_bytes:bytes===null?null:Buffer.from(bytes),parsed_json:value.parsed_json===null?null:json(value.parsed_json),
    retrieved_at:value.retrieved_at instanceof Date?value.retrieved_at.toISOString():value.retrieved_at}
}

/** Actual original domain functions under one current native unit. Network
 * acquisition and shared publication remain separate responsibilities. */
export function createSrmSupplierNativeWorkStore(options:{work:Readonly<SupplierNativeWork>;namedInterestBoundaryDigest:string;registryEnvelopeBoundaryDigest?:string;financialInventoryBoundaryDigest?:string;readyCompanyWorkBoundaryDigest?:string}){
  if(typeof window!=='undefined'||!options||Object.keys(options).filter(k=>!['registryEnvelopeBoundaryDigest','financialInventoryBoundaryDigest','readyCompanyWorkBoundaryDigest'].includes(k)).sort().join(',')!=='namedInterestBoundaryDigest,work'
    ||typeof options.work?.run!=='function'||!/^[a-f0-9]{64}$/.test(options.namedInterestBoundaryDigest))throw TypeError('Explicit native Supplier work store required')
  if(options.registryEnvelopeBoundaryDigest!==undefined&&!/^[a-f0-9]{64}$/.test(options.registryEnvelopeBoundaryDigest))return refuse()
  if(options.financialInventoryBoundaryDigest!==undefined&&!/^[a-f0-9]{64}$/.test(options.financialInventoryBoundaryDigest))return refuse()
  if(options.readyCompanyWorkBoundaryDigest!==undefined&&!/^[a-f0-9]{64}$/.test(options.readyCompanyWorkBoundaryDigest))return refuse()
  const work=options.work,namedDigest=options.namedInterestBoundaryDigest
  async function run<T>(selection:SupplierNativeWorkSelection,unitId:SupplierNativeWorkUnit,parameters:Json,
    action:(pool:DatabasePool,client:PoolClient,context:Readonly<OperationContext>)=>Promise<T>,capture:(v:T)=>T=json):Promise<T>{
    let captured:T|undefined,performed=false
    try{
      const result=await work.run(selection,unitId,{version:SUPPLIER_NATIVE_STORE_VERSION,nip:selection.command.nip,parameters},async(context,client)=>{
        const pool=bindOrganizationTransaction(selection.organisationId,client,context)
        const value=await action(pool,client,context)
        // Void domain commands have no dataset to capture. This does not
        // replace a read by absence or provide idempotency for a writer.
        captured=value===undefined?value:capture(value);performed=true
      })
      if(!performed||result.requestId!==selection.requestId||result.unitId!==unitId||result.status!=='ACCEPTED')return refuse()
      return captured as T
    }finally{captured=undefined}
  }
  async function section(input:SupplierNativeWorkSelection,section:'general'|'financial',envelope:SectionEnvelope<GeneralCompanyData>|SectionEnvelope<FinancialData>,errorCode:string|null,
      facts:FinancialSourceFact[]=[],correlationId?:string|null,sourceData?:FinancialData,cacheStatus:'CACHE'|'PROVIDER'='PROVIDER',executor:typeof run=run){
      const s=select(input),body=json({envelope,errorCode,facts,...(correlationId===undefined?{}:{correlationId}),...(sourceData===undefined?{}:{sourceData}),cacheStatus})
      if(!['general','financial'].includes(section))return refuse()
      if(section==='financial'?body.envelope.source.provider!=='MGBI':!['MGBI','KRS'].includes(body.envelope.source.provider))return refuse()
      if(section==='general'&&body.envelope.source.provider==='MGBI'&&(body.envelope.data as GeneralCompanyData|null)?.registrySource)return refuse()
      if(section==='general'&&body.envelope.source.provider==='KRS'){
        const g=body.envelope.data as GeneralCompanyData|null,ref=body.envelope.source.recordId
        if(!g||!/^KRS:[0-9]{10}:[a-f0-9]{64}$/.test(ref??'')||ref?.split(':')[1]!==g.krs
          ||g.registrySource?.provider!=='KRS'||g.registrySource.evidenceRef!==ref)return refuse()
      }
      if(section==='general'&&body.envelope.data&&'nip'in body.envelope.data&&body.envelope.data.nip!==s.command.nip)return refuse()
      return executor(s,section==='general'?'SRM_STORE_GENERAL':'SRM_STORE_FINANCIAL',{bodyDigest:digest(body)},async(pool,client)=>{
        const rows=(await client.query<{supplier_id:string}>("SELECT supplier_id FROM srm.lookup_requests WHERE organization_id=$1::uuid AND id=$2::uuid AND identifier=$3 AND entity_type='COMPANY'",[s.organisationId,s.requestId,s.command.nip])).rows
        if(rows.length!==1)return refuse()
        // The original request/attempt/snapshot is the replay authority. The
        // current native unit already serializes this request and section;
        // no receipt cache, second writer or domain ledger is introduced.
        const previous=(await client.query<{snapshot_id:string|null;matches:boolean}>(
          `SELECT snapshot.id snapshot_id,
             (a.completed_at IS NOT NULL AND a.provider=$11::text AND a.error_code IS NOT DISTINCT FROM $4::text
              AND ((a.status='NO_DATA' AND $5::jsonb='null'::jsonb AND snapshot.id IS NULL)
                OR (a.status='SUCCESS' AND snapshot.id IS NOT NULL AND projection.id IS NOT NULL
                  AND snapshot.supplier_id=$6::uuid AND snapshot.source_record_id IS NOT DISTINCT FROM $7::text
                  AND snapshot.retrieved_at=$8::timestamptz AND snapshot.effective_at IS NOT DISTINCT FROM $9::timestamptz
                  AND snapshot.payload_json=$10::jsonb AND projection.data_json=$5::jsonb))) matches
           FROM srm.provider_attempts a LEFT JOIN srm.source_snapshots snapshot
             ON snapshot.organization_id=a.organization_id AND snapshot.attempt_id=a.id AND snapshot.section=a.section
           LEFT JOIN srm.section_projections projection ON projection.organization_id=snapshot.organization_id
             AND projection.snapshot_id=snapshot.id AND projection.supplier_id=snapshot.supplier_id
             AND projection.section=snapshot.section AND projection.projection_version=1
           WHERE a.organization_id=$1::uuid AND a.request_id=$2::uuid AND a.section=$3 AND a.attempt_no=1`,
          [s.organisationId,s.requestId,section,body.errorCode,JSON.stringify(body.envelope.data),rows[0].supplier_id,
            body.envelope.source.recordId??null,body.envelope.retrievedAt,
            body.envelope.effectiveAt&&!Number.isNaN(Date.parse(body.envelope.effectiveAt))?new Date(body.envelope.effectiveAt):null,
            JSON.stringify(body.sourceData??body.envelope.data),body.envelope.source.provider])).rows
        if(previous.length){
          // A conflicting payload, unfinished/failed attempt or replacement
          // financial provenance requires a new operation or reconciliation.
          if(previous.length!==1||previous[0].matches!==true)return refuse()
          if(body.facts.length){
            const keys='amount,currencyCode,metricCode,normalizationRule,periodEnd,periodStart,periodType,sourceAmount,sourcePath,statementScope,unitCode,validationStatus'
            if(section!=='financial'||!previous[0].snapshot_id||body.facts.some(f=>!f||Object.keys(f).sort().join(',')!==keys
              ||Object.values(f).some(v=>typeof v!=='string'||v.length>4096)))return refuse()
            // Compare the original durable facts as typed values. Numeric
            // database scale and JSON property order are not new provenance;
            // missing, extra, duplicated or changed facts still conflict.
            const proof=await client.query<{matches:boolean}>(
              `WITH supplied AS(
                SELECT "metricCode","periodStart","periodEnd","periodType","statementScope",amount,"sourceAmount",
                  "normalizationRule","currencyCode","unitCode","sourcePath","validationStatus"
                FROM jsonb_to_recordset($1::jsonb) f("metricCode" text,"periodStart" date,"periodEnd" date,"periodType" text,
                  "statementScope" text,amount numeric,"sourceAmount" numeric,"normalizationRule" text,"currencyCode" text,
                  "unitCode" text,"sourcePath" text,"validationStatus" text)
              ), stored AS(
                SELECT metric_code,period_start,period_end,period_type,statement_scope,amount,source_amount,
                  normalization_rule,currency_code,unit_code,source_path,validation_status
                FROM srm.financial_facts WHERE organization_id=$2::uuid AND supplier_id=$3::uuid AND snapshot_id=$4::uuid
              ) SELECT NOT EXISTS(
                (SELECT * FROM supplied EXCEPT ALL SELECT * FROM stored)
                UNION ALL (SELECT * FROM stored EXCEPT ALL SELECT * FROM supplied)
              ) matches`,[JSON.stringify(body.facts),s.organisationId,rows[0].supplier_id,previous[0].snapshot_id])
            if(proof.rows[0]?.matches!==true)return refuse()
          }
          return previous[0].snapshot_id
        }
        const registryEnvelope=!!options.registryEnvelopeBoundaryDigest&&section==='general'&&body.envelope.source.provider==='KRS'
        if(registryEnvelope){
          const descriptor=(await client.query('SELECT srm.pilot2_registry_envelope_descriptor() AS descriptor')).rows[0]?.descriptor
          if(descriptor?.schemaDigest!==options.registryEnvelopeBoundaryDigest||descriptor.version!=='1.0.0')return refuse()
        }
        return persistSection(s.organisationId,{supplierId:rows[0].supplier_id,requestId:s.requestId},section,body.envelope,body.errorCode,body.facts,body.correlationId,body.sourceData,body.cacheStatus,pool,false,registryEnvelope)
      })
  }
  return Object.freeze({
    registerAndCache(input:SupplierNativeWorkSelection,existingSupplier:ExistingSupplierRegistration='TOUCH',now=new Date()){
      if(!options.readyCompanyWorkBoundaryDigest||!['TOUCH','KEEP'].includes(existingSupplier))return refuse()
      const s=select(input),at=new Date(now.getTime());if(!Number.isFinite(at.getTime()))return refuse()
      return run(s,'SRM_REGISTER_LOOKUP',{existingSupplier,cacheAt:at.toISOString()},async(pool,client)=>{
        const descriptor=(await client.query('SELECT srm.ready_company_work_descriptor() AS descriptor')).rows[0]?.descriptor
        if(descriptor?.schemaDigest!==options.readyCompanyWorkBoundaryDigest)return refuse()
        const lookup=await createLookup(s.organisationId,{type:'NIP',value:s.command.nip},'COMPANY',pool,s.requestId,existingSupplier)
        // A rollback to the prior database contract retains the original
        // separate CACHE_READ Work; an absent flag never means a cache miss.
        return descriptor.freshLookupVersion==='1.0.0'
          ?{lookup,cache:await readFreshCompany(s.organisationId,s.command.nip,at,pool)}:{lookup}
      })
    },
    register(input:SupplierNativeWorkSelection,existingSupplier:ExistingSupplierRegistration='TOUCH'){
      if(!['TOUCH','KEEP'].includes(existingSupplier))return refuse()
      const s=select(input);return run(s,'SRM_REGISTER_LOOKUP',existingSupplier==='KEEP'?{existingSupplier}:null,pool=>
      createLookup(s.organisationId,{type:'NIP',value:s.command.nip},'COMPANY',pool,s.requestId,existingSupplier))},
    cache(input:SupplierNativeWorkSelection,now=new Date()){
      const s=select(input),at=new Date(now.getTime());if(!Number.isFinite(at.getTime()))return refuse()
      return run(s,'SRM_CACHE_READ',{at:at.toISOString()},pool=>readFreshCompany(s.organisationId,s.command.nip,at,pool))
    },
    financialCache(input:SupplierNativeWorkSelection,now=new Date()){
      const s=select(input),at=new Date(now.getTime());if(!Number.isFinite(at.getTime()))return refuse()
      return run(s,'SRM_CACHE_READ',{section:'financial',at:at.toISOString()},async(_pool,client)=>{
        const row=(await client.query<{financial_json:(SectionEnvelope<FinancialData>&{catalogMappingVersion?:string})|null;financial_checked_at:Date|null}>(
          'SELECT financial_json,financial_checked_at FROM srm.catalog_companies WHERE nip=$1',[s.command.nip])).rows[0]
        return row?.financial_json&&isFreshCatalogEntry(row.financial_checked_at,at)&&isCurrentFinancialMapping(row.financial_json)
          &&Array.isArray(row.financial_json.warnings)?row.financial_json:null
      })
    },
    async indicators(input:SupplierNativeWorkSelection,data:FinancialData,cachedReport=false){
      if(typeof cachedReport!=='boolean')return refuse()
      const s=select(input),body=json(data)
      // The current cached report reads the same closed metric set under one
      // existing READ Work. Its RLS, current account/outcome checks and both
      // publication revision checks remain on that exact transaction.
      if(options.financialInventoryBoundaryDigest||cachedReport)return run(s,'SRM_CACHE_READ',{indicatorInputDigest:digest(body),metrics:FINANCIAL_INDICATOR_INPUT_CODES,...(cachedReport?{cachedReport:true}:{})},async(_pool,client)=>{
        const revision=await readIndicatorPublication(client,s.command.nip)
        const facts=await readStoredIndicatorFacts(client,s.command.nip,FINANCIAL_INDICATOR_INPUT_CODES)
        if(await readIndicatorPublication(client,s.command.nip)!==revision)throw Error('Indicator publication changed')
        return projectStoredIndicators(s.command.nip,body,facts)
      })
      const facts:CatalogIndicatorFact[]=[]
      let publication:string|null=null
      try{
        for(let offset=0;offset<FINANCIAL_INDICATOR_INPUT_CODES.length;offset+=4){
          const metrics=FINANCIAL_INDICATOR_INPUT_CODES.slice(offset,offset+4)
          const part:{revision:string;facts:CatalogIndicatorFact[]}=await run(s,'SRM_CACHE_READ',{indicatorInputDigest:digest(body),metrics,publication},async(_pool,client)=>{
            const revision=await readIndicatorPublication(client,s.command.nip)
            if(publication!==null&&publication!==revision)throw Error('Indicator publication changed')
            const selected=await readStoredIndicatorFacts(client,s.command.nip,metrics)
            if(await readIndicatorPublication(client,s.command.nip)!==revision)throw Error('Indicator publication changed')
            return {revision,facts:selected}
          })
          publication=part.revision
          facts.push(...part.facts)
        }
        return json(projectStoredIndicators(s.command.nip,body,facts))
      }finally{facts.length=0;publication=null}
    },
    registration(input:SupplierNativeWorkSelection){const s=select(input);return run(s,'SRM_GENERAL_METADATA_READ',null,pool=>readCompanyRegistration(s.organisationId,s.command.nip,pool))},
    pkd(input:SupplierNativeWorkSelection,general:SectionEnvelope<GeneralCompanyData>){const s=select(input),body=json(general);return run(s,'SRM_GENERAL_METADATA_READ',{bodyDigest:digest(body)},pool=>enrichCompanyPkd(s.organisationId,s.command.nip,body,pool))},
    reproject(input:SupplierNativeWorkSelection,history?:Parameters<typeof reprojectFinancialArchive>[2],includeOriginalResponse=false){
      if(typeof includeOriginalResponse!=='boolean')return refuse()
      const s=select(input),captured=history===undefined?undefined:json(history)
      return run(s,'SRM_FINANCIAL_REPROJECT_READ',{historyDigest:digest(captured??null),...(includeOriginalResponse?{includeOriginalResponse:true}:{})},pool=>reprojectFinancialArchive(s.organisationId,s.command.nip,captured,pool,includeOriginalResponse))
    },
    archive(input:SupplierNativeWorkSelection,model:'pl-krs-wp-record'|'pl-krs-rdf-record',pages:unknown[],recordCount:number,retrievedAt:string){
      const s=select(input),body=json({pages,recordCount,retrievedAt})
      if(!['pl-krs-wp-record','pl-krs-rdf-record'].includes(model))return refuse()
      // Both existing MGBI clients use the same paginated envelope. Capture
      // its complete inventory before admission; never label a foreign NIP
      // response with the current command's supplier identity.
      if(!Array.isArray(body.pages)||body.pages.length<1||body.pages.some(page=>!page||typeof page!=='object'||!Array.isArray((page as {results?:unknown}).results))
        ||!Number.isSafeInteger(body.recordCount)||body.recordCount<0)return refuse()
      const records=financialRecordsFromPages(body.pages)
      if(records.length!==body.recordCount||records.some(record=>!record||typeof record!=='object'
        ||(record as {identifiers?:{pl_nip?:unknown}}).identifiers?.pl_nip!==s.command.nip))return refuse()
      return run(s,model==='pl-krs-wp-record'?'SRM_ARCHIVE_GENERAL':'SRM_ARCHIVE_FINANCIAL',{model,bodyDigest:digest(body)},pool=>
        saveMgbiArchive(s.organisationId,s.command.nip,model,body.pages,body.recordCount,body.retrievedAt,s.requestId,pool))
    },
    prepareDocuments(input:SupplierNativeWorkSelection,pages:unknown[]){
 return diagnosticRun('DOCUMENT_PREPARE',()=>{const s=select(input),body=json(pages);return run(s,'SRM_PREPARE_DOCUMENTS',{bodyDigest:digest(body)},pool=>saveFinancialDocuments(s.organisationId,s.command.nip,body,pool))
 })
},
    financialInventory(input:SupplierNativeWorkSelection,pages:unknown[],recordCount:number,retrievedAt:string,allowedKrs:readonly string[]){
 return diagnosticRun('FINANCIAL_INVENTORY',()=>{
      const s=select(input),body=json({pages,recordCount,retrievedAt,allowedKrs})
      if(!options.financialInventoryBoundaryDigest||!Array.isArray(body.pages)||body.pages.length<1
        ||body.pages.some(page=>!page||typeof page!=='object'||!Array.isArray((page as {results?:unknown}).results))
        ||!Number.isSafeInteger(body.recordCount)||body.recordCount<0||!Number.isFinite(Date.parse(body.retrievedAt))
        ||!Array.isArray(body.allowedKrs)||body.allowedKrs.length<1||body.allowedKrs.some(k=>!/^[0-9]{10}$/.test(k)))return refuse()
      const records=financialRecordsFromPages(body.pages)
      if(records.length!==body.recordCount||records.some(record=>!record||typeof record!=='object'
        ||(record as {identifiers?:{pl_nip?:unknown}}).identifiers?.pl_nip!==s.command.nip))return refuse()
      return run(s,'SRM_FINANCIAL_INVENTORY',{bodyDigest:digest(body)},async(pool,client)=>{
        const d=(await client.query('SELECT srm.financial_inventory_descriptor() AS descriptor')).rows[0]?.descriptor
        if(d?.schemaDigest!==options.financialInventoryBoundaryDigest)return refuse()
        await saveMgbiArchive(s.organisationId,s.command.nip,'pl-krs-rdf-record',body.pages,body.recordCount,body.retrievedAt,s.requestId,pool)
        await saveFinancialDocuments(s.organisationId,s.command.nip,body.pages,pool)
        const candidates=await msrStore(s.organisationId,s.command.nip,s.requestId,body.allowedKrs,pool).candidates()
        const documents=await withOrganization(s.organisationId,c=>readPreparedFinancialDocuments(c,s.organisationId,s.command.nip),pool)
        return {candidates,documents}
      })

 })
},
    restoreDocuments(input:SupplierNativeWorkSelection){const s=select(input);return run(s,'SRM_PREPARE_DOCUMENTS',null,pool=>readFinancialDocuments(s.organisationId,s.command.nip,pool))},
    preparedDocuments(input:SupplierNativeWorkSelection){
 return diagnosticRun('DOCUMENT_READ',()=>{const s=select(input);return run(s,'SRM_READ_DOCUMENTS',null,(pool)=>withOrganization(s.organisationId,client=>readPreparedFinancialDocuments(client,s.organisationId,s.command.nip),pool))
 })
},
    section,
    async freshCompany(input:SupplierNativeWorkSelection,general:MgbiGeneralResult,financial:MgbiFinancialResult){
      const selected=select(input),g=json(general),f=json(financial)
      if(!isStructuredFreshCompany(selected.command.nip,g,f))return null
      if(!options.readyCompanyWorkBoundaryDigest)return refuse()
      return run(selected,'SRM_STORE_COMPANY',{generalDigest:digest(g),financialDigest:digest(f),postfetchVersion:'1.0.0'},async(pool,client,context)=>{
        const descriptor=(await client.query('SELECT srm.ready_company_work_descriptor() AS descriptor')).rows[0]?.descriptor
        if(descriptor?.schemaDigest!==options.readyCompanyWorkBoundaryDigest||descriptor.freshPostfetchVersion!=='1.0.0')return refuse()
        // Network acquisition is finished. Archives, prepared documents,
        // snapshots, facts and attempts share the original tenant transaction.
        // A revoked account at its outcome rolls every one of these back.
        await diagnosticRun('MGBI_GENERAL_ARCHIVE',()=>saveMgbiArchive(selected.organisationId,selected.command.nip,'pl-krs-wp-record',g.rawResponse!.pages,g.rawResponse!.recordCount,g.section.retrievedAt!,selected.requestId,pool))
        await diagnosticRun('MGBI_FINANCIAL_ARCHIVE',()=>saveMgbiArchive(selected.organisationId,selected.command.nip,'pl-krs-rdf-record',f.rawResponse!.pages,f.rawResponse!.recordCount,f.section.retrievedAt!,selected.requestId,pool))
        await saveFinancialDocuments(selected.organisationId,selected.command.nip,f.rawResponse!.pages,pool)
        const documents=await readPreparedFinancialDocuments(client,selected.organisationId,selected.command.nip)
        const sectionWithDocuments=applyFinancialDocumentMetadata(f.section,documents,g.section.data?.registryHistory)
        // The original pages are now durably archived in this transaction.
        // Return only the prepared result needed by Source publication, not
        // another captured copy of the raw financial response.
        const prepared:MgbiFinancialResult={section:sectionWithDocuments,facts:f.facts,errorCode:f.errorCode,
          ...(f.sourceData?{sourceData:applyFinancialDocumentMetadata({...sectionWithDocuments,data:f.sourceData},documents,g.section.data?.registryHistory).data??undefined}:{})}
        const local:typeof run=async(s,unit,_parameters,action,capture=json)=>{
          if(s.requestId!==selected.requestId||s.organisationId!==selected.organisationId||s.command.nip!==selected.command.nip
            ||!['SRM_STORE_GENERAL','SRM_STORE_FINANCIAL'].includes(unit))return refuse()
          const value=await action(pool,client,context);return value===undefined?value:capture(value)
        }
        const generalSnapshotId=await section(selected,'general',g.section,g.errorCode,[],undefined,undefined,'PROVIDER',local)
        const financialSnapshotId=await section(selected,'financial',prepared.section,prepared.errorCode,prepared.facts,undefined,prepared.sourceData,'PROVIDER',local)
        return {generalSnapshotId,financialSnapshotId,financial:prepared,documents}
      })
    },
    companySections(input:SupplierNativeWorkSelection,general:Readonly<{envelope:SectionEnvelope<GeneralCompanyData>;errorCode:string|null}>,
      financial:Readonly<{envelope:SectionEnvelope<FinancialData>;errorCode:string|null;facts:FinancialSourceFact[];sourceData?:FinancialData}>){
      if(!options.readyCompanyWorkBoundaryDigest)return refuse()
      const selected=select(input),g=json(general),f=json(financial)
      return run(selected,'SRM_STORE_COMPANY',{generalDigest:digest(g),financialDigest:digest(f)},async(pool,client,context)=>{
        const descriptor=(await client.query('SELECT srm.ready_company_work_descriptor() AS descriptor')).rows[0]?.descriptor
        if(descriptor?.schemaDigest!==options.readyCompanyWorkBoundaryDigest)return refuse()
        const local:typeof run=async(s,unit,_parameters,action,capture=json)=>{
          if(s.requestId!==selected.requestId||s.organisationId!==selected.organisationId||s.command.nip!==selected.command.nip
            ||!['SRM_STORE_GENERAL','SRM_STORE_FINANCIAL'].includes(unit))return refuse()
          const value=await action(pool,client,context);return value===undefined?value:capture(value)
        }
        const generalSnapshotId=await section(selected,'general',g.envelope,g.errorCode,[],undefined,undefined,'PROVIDER',local)
        const financialSnapshotId=await section(selected,'financial',f.envelope,f.errorCode,f.facts,undefined,f.sourceData,'PROVIDER',local)
        return {generalSnapshotId,financialSnapshotId}
      })
    },
    interest(input:SupplierNativeWorkSelection){
 return diagnosticRun('RECORD_INTEREST',()=>{const s=select(input);return run(s,'SRM_RECORD_INTEREST',null,async(_pool,client,context)=>{
      const d=(await client.query('SELECT srm.named_interest_descriptor() AS descriptor')).rows[0]?.descriptor
      if(d?.namedBoundaryDigest!==namedDigest||!context.subjectUserId)return refuse()
      await recordSupplierInterest(client,s.organisationId,s.command.nip,{subjectKey:'profitia-account:'+context.subjectUserId,identityKind:'AUTHENTICATED'})
    })
 })
},
    msr(input:SupplierNativeWorkSelection,allowedKrs?:readonly string[]):MsrStore{
      const s=select(input),krs=allowedKrs===undefined?undefined:json(allowedKrs)
      const candidate=(value:MsrCandidate)=>{const c=json(value);if(c.nip!==s.command.nip||!/^[a-f0-9]{24}$/.test(c.recordId))return refuse();return c}
      const domain=(pool:DatabasePool)=>msrStore(s.organisationId,s.command.nip,s.requestId,krs,pool)
      return Object.freeze({
        candidates:()=>run(s,'SRM_MSR_CANDIDATES',{allowedKrs:krs===undefined?null:[...krs]},pool=>domain(pool).candidates()),
        claim:(value,id)=>{const c=candidate(value);return run(s,'SRM_MSR_CLAIM',{candidate:c,claimId:id},pool=>domain(pool).claim(c,id))},
        read:value=>{const c=candidate(value);return run(s,'SRM_MSR_READ',{candidate:c},pool=>domain(pool).read(c),receipt)},
        receive:(value,id,source)=>{const c=candidate(value),stored=original(source,c);return run(s,'SRM_MSR_RECEIVE',{candidate:c,claimId:id,originalDigest:stored.checksum},pool=>domain(pool).receive(c,id,stored))},
        save:(value,id,source,parsed,projection,archiveChecksum)=>{
          const c=candidate(value),stored=original(source,c),p=json(parsed),view=json(projection)
          return run(s,'SRM_MSR_SAVE',{candidate:c,claimId:id,originalDigest:stored.checksum,parsedDigest:digest(p),projectionDigest:digest(view),archiveChecksum},pool=>domain(pool).save(c,id,stored,p,view,archiveChecksum))
        },
        project:(value,projection,archiveChecksum)=>{const c=candidate(value),view=json(projection);return run(s,'SRM_MSR_PROJECT',{candidate:c,projectionDigest:digest(view),archiveChecksum},pool=>domain(pool).project!(c,view,archiveChecksum))},
        block:(value,id,code)=>{const c=candidate(value);return run(s,'SRM_MSR_BLOCK',{candidate:c,claimId:id,code},pool=>domain(pool).block(c,id,code))},
      })
    },
  })
}
