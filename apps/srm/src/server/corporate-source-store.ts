import type pg from 'pg'
import type { PoolClient } from 'pg'
import { createHash } from 'node:crypto'
import type { FinancialData, GeneralCompanyData, SectionEnvelope } from '@profitia/srm-xray'
import { createPlatformIngestionHost, platformReceiptEvidence } from '@profitia/platform-contracts/platform-ingestion'
import { operationPayloadDigest, type Json } from '@profitia/platform-contracts/operation-context'
import { createSrmNativePgDriver } from './native-pg-driver'
import { readCorporateCompanyData, readCorporateFinancialData, MAX_CORPORATE_KNOWLEDGE_BYTES } from './corporate-knowledge'
import { writeSharedCompany, writeFinancialIndicators } from './shared-catalog'
import type { FinancialSourceFact } from './mgbi-financial'
import shape from './corporate-source-shape.json'
import {writeReadyCompanyReport} from './ready-report-source'
import type {FinancialSourceDocument} from './financial-documents'
import type {PreparedCompanyReport} from './ready-report'
import type {CalculatedFinancialIndicator} from './financial-indicators'
import {measureSupplierStage} from './supplier-telemetry'

export const CORPORATE_PUBLICATION_VERSION = 'srm-corporate-publication-v1'
export const CORPORATE_SOURCE = Object.freeze({ id: 'srm.catalog.corporate', payloadSchema: CORPORATE_PUBLICATION_VERSION,
  qualityVersion: 'srm-corporate-quality-v1', classificationVersion: 'srm-corporate-fields-v2' })
export type CorporatePacket = { version: typeof CORPORATE_PUBLICATION_VERSION; nip: string
  general: SectionEnvelope<GeneralCompanyData>; financial: SectionEnvelope<FinancialData>
  facts: FinancialSourceFact[]; preserveGeneral: boolean }
// Data validation only. A private identity brand cannot be supplied by a caller,
// and the entire detached graph is immutable before it can be reused. Source
// admission, current authority, publication checks and audit still run per call.
const capturedPackets = new WeakMap<object, Readonly<{body:string}>>()
function freezePacket<T>(value:T):T {
  if(value&&typeof value==='object'){
    for(const child of Object.values(value))freezePacket(child)
    Object.freeze(value)
  }
  return value
}
const packetBody=(packet:CorporatePacket):string=>capturedPackets.get(packet)?.body??unavailable()
type Spec = string | Spec[] | { [key: string]: Spec }
const unavailable = (): never => { throw new TypeError('Classified corporate publication required') }
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
/** Explicit absence of a General acquisition, never fabricated KRS/MGBI data. */
export const unrequestedCorporateGeneral=():SectionEnvelope<GeneralCompanyData>=>({status:'NOT_REQUESTED',
 source:{provider:'MGBI',model:'pl-krs-wp-record',recordId:null},data:null,retrievedAt:null,effectiveAt:null,warnings:[]})
const financialOnlySpec={...shape.packet,general:{...shape.packet.general,data:{$nullable:'@general'}}}
function financialOnlyCandidate(value:unknown):boolean{
 if(!value||typeof value!=='object')return false
 const general=Object.getOwnPropertyDescriptor(value,'general')?.value
 return Object.getOwnPropertyDescriptor(value,'preserveGeneral')?.value===true&&general&&typeof general==='object'
  &&Object.getOwnPropertyDescriptor(general,'data')?.value===null
}
const msrBasis = Object.freeze({iXBRL:'MGBI_IAS_FLAG_AND_IXBRL_CONTEXTS_V1',XHTML:'MGBI_IAS_FLAG_AND_XHTML_PRIMARY_CELLS_V1'})
function factProvenance(path:string,fact:FinancialSourceFact,periods:FinancialData['periods']):boolean {
  // Structured provider paths retain their existing class, but cannot relabel
  // a fact belonging to an original MSR projection as structured provider data.
  if(path.startsWith('content.'))return periods.some(p=>!Object.values(msrBasis).includes(p.accountingStandardBasis as typeof msrBasis[keyof typeof msrBasis]))
  const source=/^([a-f0-9]{24})\.(iXBRL|XHTML)\.([^\s\x00-\x1f\x7f/\\?#]{1,1024})$/u.exec(path)
  if(!source||fact.normalizationRule!=='SOURCE_VALUE'||fact.validationStatus!=='VALID'||fact.sourceAmount!==fact.amount)return false
  return periods.some(p=>p.documentId.replace(/:(?:cfy|pfy)$/,'')===source[1]
    &&/:(?:cfy|pfy)$/.test(p.documentId)&&p.accountingStandard==='IAS_IFRS'&&p.isIasCompliant===true
    &&p.accountingStandardBasis===msrBasis[source[2] as keyof typeof msrBasis])
}


/** Same closed packet shape is installed under controlled SQL ownership. This
 * does not detect personal information hidden inside arbitrary text. */
export function readCorporatePacket(input: unknown): CorporatePacket {
  if(input&&typeof input==='object'&&capturedPackets.has(input))return input as CorporatePacket
  let nodes = 0
  const seen = new Set<object>()
  const read = (value: unknown, spec: Spec, depth: number): void => {
    if (++nodes > 500_000 || depth > 32) return unavailable()
    if (typeof spec === 'string') {
      if (spec.startsWith('@')) return read(value, (shape as Record<string, Spec>)[spec.slice(1)], depth)
      if (spec.startsWith('=')) { if (value !== spec.slice(1)) return unavailable(); return }
      if (spec === '$bool') { if (typeof value !== 'boolean') return unavailable(); return }
      if (spec === '$number') { if (typeof value !== 'number' || !Number.isFinite(value)) return unavailable(); return }
      if (typeof value !== 'string' || value.length > 4096 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) return unavailable()
      if (spec === '$nip' && !/^\d{10}$/.test(value) || spec === '$record' && !/^[a-f0-9]{24}$/.test(value)
        || spec === '$amount' && (value.length > 128 || !/^-?\d+(?:\.\d+)?$/.test(value))
        || spec === '$date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)
        || spec === '$dateTime' && (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z)?$/.test(value) || !Number.isFinite(Date.parse(value)))
        || spec === '$timestamp' && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value) || !Number.isFinite(Date.parse(value)))) return unavailable()
      if (['$timestamp', '$dateTime'].includes(spec) && new Date(value).toISOString().slice(0, 10) !== value.slice(0, 10)) return unavailable()
      return
    }
    if (spec && !Array.isArray(spec) && Object.hasOwn(spec, '$nullable')) { if (value !== null) read(value, spec.$nullable, depth); return }
    if (!value || typeof value !== 'object' || seen.has(value)) return unavailable()
    seen.add(value)
    try {
      if (Array.isArray(spec)) {
        if (!Array.isArray(value) || value.length > 16384 || Reflect.ownKeys(value).length !== value.length + 1) return unavailable()
        for (let i = 0; i < value.length; i++) { const d = Object.getOwnPropertyDescriptor(value, String(i)); if (!d || !('value' in d)) return unavailable(); read(d.value, spec[0], depth + 1) }
      } else {
        if (Object.getPrototypeOf(value) !== Object.prototype) return unavailable()
        const descriptors = Object.getOwnPropertyDescriptors(value)
        if (Reflect.ownKeys(value).length !== Object.keys(descriptors).length) return unavailable()
        for (const [key, d] of Object.entries(descriptors)) {
          const rule = spec[key] ?? spec[key + '?']
          if (!d.enumerable || !('value' in d) || rule === undefined) return unavailable()
          // Declared optional undefined has the same omission as JSON output.
          if (d.value === undefined && !Object.hasOwn(spec, key)) continue
          read(d.value, rule, depth + 1)
        }
        if (Object.keys(spec).some(key => !key.endsWith('?') && !Object.hasOwn(value, key))) return unavailable()
      }
    } finally { seen.delete(value) }
  }
  const financialOnly=financialOnlyCandidate(input)
  read(input, financialOnly?financialOnlySpec:shape.packet, 0)
  const encoded = JSON.stringify(input)
  if (Buffer.byteLength(encoded) > MAX_CORPORATE_KNOWLEDGE_BYTES) return unavailable()
  const packet = JSON.parse(encoded) as CorporatePacket
  if(financialOnly){
    if(packet.general.status!=='NOT_REQUESTED'||packet.general.source.recordId!==null||packet.general.retrievedAt!==null
      ||packet.general.effectiveAt!==null||packet.general.warnings.length)return unavailable()
  }else readCorporateCompanyData(packet.general.data, packet.nip)
  readCorporateFinancialData(packet.financial.data)
  for (const section of [packet.general, packet.financial]) {
    if (!['SUCCESS', 'PARTIAL', 'EMPTY', 'NOT_REQUESTED', 'ERROR'].includes(section.status)) return unavailable()
    if (section.data !== null && !['SUCCESS', 'PARTIAL'].includes(section.status)
      || ['SUCCESS', 'PARTIAL', 'EMPTY'].includes(section.status) && section.retrievedAt === null) return unavailable()
  }
  if (packet.facts.length && (!packet.financial.data || !['SUCCESS', 'PARTIAL'].includes(packet.financial.status))) return unavailable()
  for (const f of packet.facts) {
    const periods=packet.financial.data?.periods.filter(p=>p.from===f.periodStart&&p.to===f.periodEnd
      &&p.scope===(f.statementScope==='UNIT'?'standalone':'consolidated')
      &&p.facts.some(v=>v.metricCode===f.metricCode&&v.amount===f.amount&&v.currency===f.currencyCode&&v.unit===f.unitCode))??[]
    if (!['YEAR', 'QUARTER', 'MONTH', 'OTHER'].includes(f.periodType) || !['UNIT', 'CONSOLIDATED'].includes(f.statementScope)
      || !['SOURCE_VALUE', 'VERIFIED_COST_MAGNITUDE_V1', 'UNVERIFIED_COST_SIGN'].includes(f.normalizationRule)
      || !['VALID', 'REVIEW'].includes(f.validationStatus) || !factProvenance(f.sourcePath,f,periods)
      || f.periodStart > f.periodEnd || !/^[A-Z][A-Z0-9_]{1,79}$/.test(f.metricCode)
      || !periods.length) return unavailable()
  }
  freezePacket(packet)
  capturedPackets.set(packet,Object.freeze({body:encoded}))
  return packet
}

/** Complete classified evidence, independent of a private lookup identity. */
export function corporateRevisionKey(input:unknown,publicationSchemaDigest:string):string {
  if(!/^[a-f0-9]{64}$/.test(publicationSchemaDigest))return unavailable()
  const packet=readCorporatePacket(input)
  const prefix=JSON.stringify({version:'srm-corporate-revision-v1',source:CORPORATE_SOURCE,publicationSchemaDigest})
  // Exactly the existing JSON envelope and revision bytes; the packet body was
  // serialized and validated before the detached graph was frozen.
  return hash(prefix.slice(0,-1)+',"packet":'+packetBody(packet)+'}')
}

export function createSrmCorporateSourceStore(options: {
  application: Parameters<typeof createPlatformIngestionHost<PoolClient>>[0]['application']
  binding: Parameters<typeof createPlatformIngestionHost<PoolClient>>[0]['binding']
  readyReportSchemaDigest?:string; publicationSchemaDigest: string; pool: pg.Pool; auditPool: pg.Pool; now?: () => number
}) {
  if (typeof window !== 'undefined' || options.application.appId !== 'srm-corporate-source'
    || !/^[a-f0-9]{64}$/.test(options.publicationSchemaDigest)) return unavailable()
  const publicationSchemaDigest = options.publicationSchemaDigest
  const driver = createSrmNativePgDriver(options.pool, options.auditPool)
  const verify = async (client: PoolClient): Promise<void> => {
    const d = (await client.query('SELECT profitia_srm_catalog.runtime_descriptor() AS descriptor')).rows[0]?.descriptor
    if (!d || d.schemaDigest !== publicationSchemaDigest || d.version !== CORPORATE_PUBLICATION_VERSION
      || operationPayloadDigest(d.fieldSchema) !== operationPayloadDigest(shape as Json)) return unavailable()
  }
  const host = createPlatformIngestionHost<PoolClient>({ application: options.application, binding: options.binding,
    source: CORPORATE_SOURCE, ...driver, now: options.now,
    validateSharedPayload: async (value, session) => {
      await verify(session.transaction)
      return !!value && typeof value === 'object' && !Array.isArray(value)
        && Object.keys(value).sort().join(',') === 'bodyDigest,nip,version'
        && value.version === CORPORATE_PUBLICATION_VERSION && /^[a-f0-9]{64}$/.test(String(value.bodyDigest)) && /^\d{10}$/.test(String(value.nip))
    },
  })
  return Object.freeze({
    async publish(input: unknown, idempotencyKey: string, preparation?:Readonly<{documents:readonly FinancialSourceDocument[];retainCurrentCatalog?:boolean;onPrepared?:(report:PreparedCompanyReport)=>void}>) {
      let prepared:PreparedCompanyReport|undefined
      const documents=preparation?structuredClone(preparation.documents):undefined
      const retainCurrentCatalog=preparation?.retainCurrentCatalog===true
      if(options.readyReportSchemaDigest&&(!/^[a-f0-9]{64}$/.test(options.readyReportSchemaDigest)||!documents))return unavailable()
      // Capture once before awaiting. HTTP callers never supply owner IDs,
      // evidence IDs, write callbacks or a mutable body after admission.
      const packet = readCorporatePacket(input), body = packetBody(packet)
      const manifest = { bodyDigest: hash(body), nip: packet.nip, version: CORPORATE_PUBLICATION_VERSION }
      const result = await measureSupplierStage('CORPORATE_PUBLICATION',()=>host.ingest({ resourceId: 'srm-corporate:' + packet.nip, payload: manifest, idempotencyKey }, async (_manifest, client, context) => {
        await verify(client)
        const effectId = context.platformReservation?.effectId
        if (!effectId) return unavailable()
        // The additive optional port validates only Financial. Its absence
        // fails closed; it never fetches or relabels another General provider.
        const port=financialOnlyCandidate(packet)?'open_financial_publication':'open_publication'
        const admitted = await measureSupplierStage('CORPORATE_ADMISSION',()=>client.query(`SELECT profitia_srm_catalog.${port}($1::uuid,$2::uuid,$3) AS admitted`, [effectId, context.decisionId, body]))
        if (admitted.rows[0]?.admitted !== true) return unavailable()
        // Selector only: SQL still authenticates the actual protected Source
        // publication for each statement. It grants no authority by itself.
        await client.query("SELECT set_config('profitia.srm.catalog.nip',$1,true)",[packet.nip])
        let inserted: import('./shared-catalog').InsertedCompanyPublication|undefined
        if(retainCurrentCatalog){
          // A one-time READY upgrade consumes the exact retained sections.
          // It never rewrites their hash, provider timestamp or Source proof.
          if(!packet.preserveGeneral||packet.facts.length)return unavailable()
          const retained=(await client.query(`SELECT general_json=$2::jsonb
            AND financial_json-'catalogMappingVersion'=$3::jsonb AS matches
            FROM srm.catalog_companies WHERE nip=$1 FOR SHARE`,
            [packet.nip,JSON.stringify(packet.general),JSON.stringify(packet.financial)])).rows[0]
          if(retained?.matches!==true)return unavailable()
        }else await measureSupplierStage('CORPORATE_WRITE',()=>writeSharedCompany(client, null, packet.nip, { ...packet, generalSnapshotId: effectId, financialSnapshotId: effectId },value=>{inserted=value}))
        let indicators:CalculatedFinancialIndicator[]=[]
        if (packet.financial.data) await measureSupplierStage('CORPORATE_INDICATORS',()=>writeFinancialIndicators(client, packet.nip, packet.financial.data!,rows=>{indicators=rows},inserted))
        if(options.readyReportSchemaDigest)prepared=await measureSupplierStage('REPORT_PREPARATION',()=>writeReadyCompanyReport(client,packet.nip,effectId,indicators,documents!,options.readyReportSchemaDigest!,inserted))
      })).catch(error=>{
        let cause:unknown=error,timeout=false
        for(let depth=0;depth<8&&cause instanceof Error;depth++){
          if(cause.message==='Private transaction timed out')timeout=true
          cause=cause.cause
        }
        // Exact reviewed driver message only; never SQL, parameters or the raw
        // provider/database error. Preserve the original exception unchanged.
        console.error(JSON.stringify({event:'srm_corporate_publication_failure',reason:timeout?'NATIVE_TRANSACTION_TIMEOUT':'PUBLICATION_REFUSED'}))
        throw error
      })
      if (!platformReceiptEvidence(result.value)) return unavailable()
      if(prepared)preparation?.onPrepared?.(structuredClone(prepared))
      return result.value
    },
  })
}
