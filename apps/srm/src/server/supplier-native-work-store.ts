import { createHash } from 'node:crypto'
import type { PoolClient } from 'pg'
import { OperationDenied, operationPayloadDigest, type Json, type OperationContext } from '@profitia/platform-contracts/operation-context'
import { bindOrganizationTransaction, withOrganization, type DatabasePool } from './db'
import { readSupplierRequest } from './supplier-request-operation'
import type { SupplierNativeWork, SupplierNativeWorkSelection, SupplierNativeWorkUnit } from './supplier-request-work'
import { createLookup, type ExistingSupplierRegistration } from './xray-repository'
import { persistSection } from './xray-lookup'
import { readFreshCompany, readFinancialIndicators, recordSupplierInterest } from './shared-catalog'
import { readCompanyRegistration } from './company-activity'
import { enrichCompanyPkd } from './company-pkd'
import { reprojectFinancialArchive, type FinancialSourceFact } from './mgbi-financial'
import { saveMgbiArchive } from './mgbi-archive'
import { financialRecordsFromPages, readFinancialDocuments, readPreparedFinancialDocuments, saveFinancialDocuments } from './financial-documents'
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
const digest=(value:unknown)=>operationPayloadDigest(value as Json)
function json<T>(value:T):T{
  let text:string|undefined
  try{text=JSON.stringify(value,(_key,v)=>{if(typeof v==='number'&&!Number.isFinite(v))return refuse();return v})}catch{return refuse()}
  if(!text||Buffer.byteLength(text)>MAX_JSON_BYTES)return refuse()
  const captured=JSON.parse(text) as T
  operationPayloadDigest(captured as Json)
  return freeze(captured)
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
export function createSrmSupplierNativeWorkStore(options:{work:Readonly<SupplierNativeWork>;namedInterestBoundaryDigest:string}){
  if(typeof window!=='undefined'||!options||Object.keys(options).sort().join(',')!=='namedInterestBoundaryDigest,work'
    ||typeof options.work?.run!=='function'||!/^[a-f0-9]{64}$/.test(options.namedInterestBoundaryDigest))throw TypeError('Explicit native Supplier work store required')
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
  return Object.freeze({
    register(input:SupplierNativeWorkSelection,existingSupplier:ExistingSupplierRegistration='TOUCH'){
      if(!['TOUCH','KEEP'].includes(existingSupplier))return refuse()
      const s=select(input);return run(s,'SRM_REGISTER_LOOKUP',existingSupplier==='KEEP'?{existingSupplier}:null,pool=>
      createLookup(s.organisationId,{type:'NIP',value:s.command.nip},'COMPANY',pool,s.requestId,existingSupplier))},
    cache(input:SupplierNativeWorkSelection,now=new Date()){
      const s=select(input),at=new Date(now.getTime());if(!Number.isFinite(at.getTime()))return refuse()
      return run(s,'SRM_CACHE_READ',{at:at.toISOString()},pool=>readFreshCompany(s.organisationId,s.command.nip,at,pool))
    },
    indicators(input:SupplierNativeWorkSelection,data:FinancialData){
      const s=select(input),body=json(data)
      return run(s,'SRM_CACHE_READ',{indicatorInputDigest:digest(body)},(_pool,client)=>readFinancialIndicators(client,s.command.nip,body))
    },
    registration(input:SupplierNativeWorkSelection){const s=select(input);return run(s,'SRM_GENERAL_METADATA_READ',null,pool=>readCompanyRegistration(s.organisationId,s.command.nip,pool))},
    pkd(input:SupplierNativeWorkSelection,general:SectionEnvelope<GeneralCompanyData>){const s=select(input),body=json(general);return run(s,'SRM_GENERAL_METADATA_READ',{bodyDigest:digest(body)},pool=>enrichCompanyPkd(s.organisationId,s.command.nip,body,pool))},
    reproject(input:SupplierNativeWorkSelection,history?:Parameters<typeof reprojectFinancialArchive>[2]){
      const s=select(input),captured=history===undefined?undefined:json(history)
      return run(s,'SRM_FINANCIAL_REPROJECT_READ',{historyDigest:digest(captured??null)},pool=>reprojectFinancialArchive(s.organisationId,s.command.nip,captured,pool))
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
      return run(s,model==='pl-krs-wp-record'?'SRM_ARCHIVE_GENERAL':'SRM_ARCHIVE_FINANCIAL',{model,bodyDigest:operationPayloadDigest(body as Json)},pool=>
        saveMgbiArchive(s.organisationId,s.command.nip,model,body.pages,body.recordCount,body.retrievedAt,s.requestId,pool))
    },
    prepareDocuments(input:SupplierNativeWorkSelection,pages:unknown[]){const s=select(input),body=json(pages);return run(s,'SRM_PREPARE_DOCUMENTS',{bodyDigest:operationPayloadDigest(body as Json)},pool=>saveFinancialDocuments(s.organisationId,s.command.nip,body,pool))},
    restoreDocuments(input:SupplierNativeWorkSelection){const s=select(input);return run(s,'SRM_PREPARE_DOCUMENTS',null,pool=>readFinancialDocuments(s.organisationId,s.command.nip,pool))},
    preparedDocuments(input:SupplierNativeWorkSelection){const s=select(input);return run(s,'SRM_READ_DOCUMENTS',null,(pool)=>withOrganization(s.organisationId,client=>readPreparedFinancialDocuments(client,s.organisationId,s.command.nip),pool))},
    section(input:SupplierNativeWorkSelection,section:'general'|'financial',envelope:SectionEnvelope<GeneralCompanyData>|SectionEnvelope<FinancialData>,errorCode:string|null,
      facts:FinancialSourceFact[]=[],correlationId?:string|null,sourceData?:FinancialData,cacheStatus:'CACHE'|'PROVIDER'='PROVIDER'){
      const s=select(input),body=json({envelope,errorCode,facts,...(correlationId===undefined?{}:{correlationId}),...(sourceData===undefined?{}:{sourceData}),cacheStatus})
      if(!['general','financial'].includes(section))return refuse()
      if(section==='general'&&body.envelope.data&&'nip'in body.envelope.data&&body.envelope.data.nip!==s.command.nip)return refuse()
      return run(s,section==='general'?'SRM_STORE_GENERAL':'SRM_STORE_FINANCIAL',{bodyDigest:digest(body)},async(pool,client)=>{
        const rows=(await client.query<{supplier_id:string}>("SELECT supplier_id FROM srm.lookup_requests WHERE organization_id=$1::uuid AND id=$2::uuid AND identifier=$3 AND entity_type='COMPANY'",[s.organisationId,s.requestId,s.command.nip])).rows
        if(rows.length!==1)return refuse()
        // The original request/attempt/snapshot is the replay authority. The
        // current native unit already serializes this request and section;
        // no receipt cache, second writer or domain ledger is introduced.
        const previous=(await client.query<{snapshot_id:string|null;matches:boolean}>(
          `SELECT snapshot.id snapshot_id,
             (a.completed_at IS NOT NULL AND a.error_code IS NOT DISTINCT FROM $4::text
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
            JSON.stringify(body.sourceData??body.envelope.data)])).rows
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
        return persistSection(s.organisationId,{supplierId:rows[0].supplier_id,requestId:s.requestId},section,body.envelope,body.errorCode,body.facts,body.correlationId,body.sourceData,body.cacheStatus,pool)
      })
    },
    interest(input:SupplierNativeWorkSelection){const s=select(input);return run(s,'SRM_RECORD_INTEREST',null,async(_pool,client,context)=>{
      const d=(await client.query('SELECT srm.named_interest_descriptor() AS descriptor')).rows[0]?.descriptor
      if(d?.namedBoundaryDigest!==namedDigest||!context.subjectUserId)return refuse()
      await recordSupplierInterest(client,s.organisationId,s.command.nip,{subjectKey:'profitia-account:'+context.subjectUserId,identityKind:'AUTHENTICATED'})
    })},
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
